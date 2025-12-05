import { Router, Request, Response } from "express";
import { db } from "../db";
import { branches } from "@shared/schema";
import { eq, sql, and } from "drizzle-orm";
import { z } from "zod";

// Define the Branch interface
type Branch = {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
};

// Helper function to transform branch data from DB to API format
function transformBranch(branch: Branch) {
  return {
    id: branch.id,
    name: branch.name,
    address: branch.address,
    phone: branch.phone,
    isActive: Boolean(branch.is_active),
    createdAt: branch.created_at,
  };
}

export function registerBranchesRoutes(router: Router) {
  // Get all branches with pagination and search
  router.get("/api/branches", async (req: Request, res: Response) => {
    try {
      const search = req.query.search as string | undefined;
      let query = sql`SELECT * FROM branches`;

      if (search) {
        const searchTerm = `%${search}%`;
        query = sql`SELECT * FROM branches WHERE name LIKE ${searchTerm} OR address LIKE ${searchTerm}`;
      }

      const allBranches = await db.all<Branch>(query);
      const transformedBranches = allBranches.map(transformBranch);
      res.json({ branches: transformedBranches });
    } catch (error) {
      console.error("Error fetching branches:", error);
      res.status(500).json({ message: "Failed to fetch branches" });
    }
  });

  // Get a single branch by ID
  router.get("/api/branches/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const branch = await db.get<Branch>(sql`
        SELECT * FROM branches WHERE id = ${id}
      `);
      if (!branch) {
        return res.status(404).json({ message: "Branch not found" });
      }

      res.json(transformBranch(branch));
    } catch (error) {
      console.error("Error fetching branch:", error);
      res.status(500).json({ message: "Failed to fetch branch" });
    }
  });

  // Create a new branch
  router.post("/api/branches", async (req: Request, res: Response) => {
    try {
      console.log('Received request body:', req.body);
      
      const schema = z.object({
        name: z.string().min(1, "Name is required"),
        address: z.string().min(1, "Address is required"),
        phone: z.string().optional(),
        isActive: z.boolean().default(true),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        console.log('Validation error:', result.error);
        return res.status(400).json({
          message: "Validation error",
          errors: result.error.flatten().fieldErrors,
        });
      }

      const branchId = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const isActive = result.data.isActive ? 1 : 0;
      
      console.log('Attempting to insert branch:', {
        ...result.data,
        id: branchId,
        created_at: createdAt,
        is_active: isActive
      });

      try {
        // Insert the new branch using Drizzle's sql template literal
        await db.run(sql`
          INSERT INTO branches (id, name, address, phone, is_active, created_at)
          VALUES (
            ${branchId},
            ${result.data.name},
            ${result.data.address},
            ${result.data.phone || null},
            ${isActive ? 1 : 0},
            ${createdAt}
          )
        `);
        
        console.log('Branch inserted successfully, fetching...');
        
        // Get the newly created branch using Drizzle's sql template literal
        const newBranch = await db.get<Branch>(sql`
          SELECT * FROM branches WHERE id = ${branchId}
        `);

        if (!newBranch) {
          throw new Error("Failed to retrieve created branch");
        }

        console.log('Retrieved new branch:', newBranch);
        res.status(201).json(transformBranch(newBranch));
        
      } catch (dbError) {
        console.error('Database error:', dbError);
        throw dbError;
      }
    } catch (error) {
      console.error("Error creating branch:", error);
      res.status(500).json({ 
        message: "Failed to create branch",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update a branch
  router.put("/api/branches/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const schema = z.object({
        name: z.string().min(1, "Name is required"),
        address: z.string().min(1, "Address is required"),
        phone: z.string().optional(),
        isActive: z.boolean(),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: result.error.flatten().fieldErrors,
        });
      }

      // Update the branch using Drizzle's sql template
      const isActive = result.data.isActive ? 1 : 0;
      const phone = result.data.phone || null;

      await db.run(sql`
        UPDATE branches
        SET name = ${result.data.name},
            address = ${result.data.address},
            phone = ${phone},
            is_active = ${isActive}
        WHERE id = ${id}
      `);

      // Get the updated branch
      const updatedBranch = await db.get<Branch>(sql`
        SELECT * FROM branches WHERE id = ${id}
      `);

      if (!updatedBranch) {
        return res.status(404).json({ message: "Branch not found" });
      }

      res.json(transformBranch(updatedBranch));
    } catch (error) {
      console.error("Error updating branch:", error);
      res.status(500).json({ message: "Failed to update branch" });
    }
  });

  // Delete a branch (soft delete by setting isActive to false)
  router.delete("/api/branches/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      const [updatedBranch] = await db
        .update(branches)
        .set({ isActive: false })
        .where(and(eq(branches.id, id), eq(branches.isActive, true)))
        .returning();

      if (!updatedBranch) {
        return res.status(404).json({ message: "Active branch not found" });
      }

      res.json({ message: "Branch deactivated successfully" });
    } catch (error) {
      console.error("Error deactivating branch:", error);
      res.status(500).json({ message: "Failed to deactivate branch" });
    }
  });
}
