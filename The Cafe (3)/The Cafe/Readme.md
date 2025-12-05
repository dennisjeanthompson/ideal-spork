# Overview

A full-stack employee management system for café businesses built with React, Express, and PostgreSQL. The application provides comprehensive time tracking, shift scheduling, payroll management, and branch administration capabilities with role-based access control for employees and managers.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **React with TypeScript**: Modern component-based UI using functional components and hooks
- **Vite**: Fast development server and build tool with hot module replacement
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state management with built-in caching and synchronization
- **UI Components**: Radix UI primitives with Tailwind CSS for styling, following shadcn/ui design system
- **Form Handling**: React Hook Form with Zod validation for type-safe form management

## Backend Architecture
- **Express.js**: RESTful API server with middleware-based request handling
- **Session Management**: Express sessions with PostgreSQL store for authentication state
- **Database Layer**: Drizzle ORM for type-safe database operations and migrations
- **Authentication**: Session-based authentication with role-based access control (employee/manager)
- **API Design**: Resource-based routes with consistent error handling and logging middleware

## Data Storage
- **PostgreSQL**: Primary database using Neon serverless PostgreSQL
- **Schema Design**: Normalized relational schema with foreign key relationships
- **Core Entities**: 
  - Users (with roles and branch assignments)
  - Branches (multi-location support)
  - Time entries (clock in/out tracking)
  - Shifts (scheduled work periods)
  - Shift trades (employee shift exchange)
  - Payroll periods and entries
  - Approval workflows

## Authentication & Authorization
- **Session-based Authentication**: Server-side sessions stored in PostgreSQL
- **Role-based Access Control**: Employee and manager roles with different permission levels
- **Branch-level Isolation**: Users scoped to specific branches with managers having cross-branch access
- **Middleware Protection**: Route-level authentication and authorization checks

## Key Design Patterns
- **Repository Pattern**: Abstract storage interface with concrete implementations
- **Component Composition**: Reusable UI components with props-based customization
- **Custom Hooks**: Encapsulated client-side logic for data fetching and state management
- **Middleware Chain**: Express middleware for logging, authentication, and error handling
- **Type Safety**: End-to-end TypeScript with shared schema definitions

# External Dependencies

## Database & ORM
- **@neondatabase/serverless**: Serverless PostgreSQL driver for Neon database
- **drizzle-orm**: Type-safe ORM with automatic migration support
- **drizzle-zod**: Schema validation integration between Drizzle and Zod

## Frontend Libraries  
- **@tanstack/react-query**: Server state management with caching and synchronization
- **@radix-ui/react-***: Accessible UI component primitives (dialogs, dropdowns, forms, etc.)
- **tailwindcss**: Utility-first CSS framework for styling
- **wouter**: Lightweight client-side routing library
- **react-hook-form**: Performant form library with validation
- **zod**: TypeScript-first schema validation

## Backend Libraries
- **express**: Web application framework
- **express-session**: Session middleware for authentication
- **connect-pg-simple**: PostgreSQL session store
- **date-fns**: Date manipulation and formatting utilities

## Development Tools
- **vite**: Build tool with fast HMR and optimized production builds
- **typescript**: Static type checking across the entire stack
- **esbuild**: Fast JavaScript bundler for server-side builds



Important Commands to use:
For fresh databse
```bash
npm run dev:fresh
```
For interactive mode
```bash
npm run dev:interactive
```
For production
```bash
npm run start
```

Sample data credentials:
Manager:
- username: sarah
- password: password123

Employee:
- username: john
- password: password123
john / password123 - Barista
jane / password123 - Cashier
mike / password123 - Chef
emma / password123 - Barista

Admin Account for the tax edit:
admin
admin123



FIRST STEP TO LOAD SAMPLE DATA 

1ST COMMAND
npm install package.json

2ND COMMAND
npm run dev:interactive

3RD
select option 2 for fresh data base when it finishes loading exit ctrl c to top the server and npm run dev:interactive again and select option 3
when it finishes loading stop the server again and run npm run dev only
 