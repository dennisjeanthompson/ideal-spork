import { z } from "zod";

// Blockchain configuration
export const blockchainConfig = {
  network: process.env.BLOCKCHAIN_NETWORK || "sepolia", // ethereum testnet
  rpcUrl: process.env.BLOCKCHAIN_RPC_URL || "https://sepolia.infura.io/v3/YOUR_PROJECT_ID",
  contractAddress: process.env.BLOCKCHAIN_CONTRACT_ADDRESS || "0x...",
  privateKey: process.env.BLOCKCHAIN_PRIVATE_KEY || "",
  chainId: process.env.BLOCKCHAIN_CHAIN_ID ? parseInt(process.env.BLOCKCHAIN_CHAIN_ID) : 11155111, // Sepolia
};

// Payroll record for blockchain
export interface BlockchainPayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  periodStart: string;
  periodEnd: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  hourlyRate: number;
  grossPay: number;
  deductions: number;
  netPay: number;
  blockchainHash: string;
  blockNumber: number;
  transactionHash: string;
  timestamp: string;
  verified: boolean;
}

// Blockchain transaction types
export const blockchainTransactionSchema = z.object({
  type: z.enum(["payroll_record", "payslip_verification", "contract_update"]),
  data: z.record(z.any()),
  signature: z.string(),
  timestamp: z.string(),
});

export type BlockchainTransaction = z.infer<typeof blockchainTransactionSchema>;

// Blockchain verification status
export interface BlockchainVerification {
  recordId: string;
  isVerified: boolean;
  blockNumber: number;
  transactionHash: string;
  verificationDate: string;
  verifierAddress: string;
}
