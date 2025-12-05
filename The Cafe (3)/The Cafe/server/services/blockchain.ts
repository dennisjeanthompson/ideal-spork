import { ethers } from 'ethers';
import { blockchainConfig } from '../../shared/blockchain';
import crypto from 'crypto';

// Re-export types for use in this service
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

export interface BlockchainVerification {
  recordId: string;
  isVerified: boolean;
  blockNumber: number;
  transactionHash: string;
  verificationDate: string;
  verifierAddress: string;
}

export class BlockchainService {
  private provider: ethers.Provider;
  private contract: any;
  private blockCounter: number = 5000000; // Starting block number
  private storedRecords: Map<string, BlockchainPayrollRecord> = new Map(); // In-memory blockchain simulation

  constructor() {
    this.provider = new ethers.JsonRpcProvider(blockchainConfig.rpcUrl);
  }

  /**
   * Generate a hash for payroll record verification
   */
  private generatePayrollHash(record: Omit<BlockchainPayrollRecord, 'blockchainHash' | 'blockNumber' | 'transactionHash' | 'timestamp' | 'verified'>): string {
    const dataString = JSON.stringify({
      employeeId: record.employeeId,
      employeeName: record.employeeName,
      periodStart: record.periodStart,
      periodEnd: record.periodEnd,
      totalHours: record.totalHours,
      regularHours: record.regularHours,
      overtimeHours: record.overtimeHours,
      hourlyRate: record.hourlyRate,
      grossPay: record.grossPay,
      deductions: record.deductions,
      netPay: record.netPay,
    });

    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Generate deterministic transaction hash from record hash and timestamp
   */
  private generateTransactionHash(recordHash: string, timestamp: string): string {
    const combined = `${recordHash}${timestamp}`;
    return '0x' + crypto.createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Store payroll record on blockchain (simulated)
   */
  async storePayrollRecord(record: Omit<BlockchainPayrollRecord, 'blockchainHash' | 'blockNumber' | 'transactionHash' | 'timestamp' | 'verified'>): Promise<BlockchainPayrollRecord> {
    try {
      const hash = this.generatePayrollHash(record);
      const timestamp = new Date().toISOString();
      const transactionHash = this.generateTransactionHash(hash, timestamp);

      // Increment block counter for each new transaction
      this.blockCounter++;

      // Simulate blockchain storage
      const blockchainRecord: BlockchainPayrollRecord = {
        ...record,
        blockchainHash: hash,
        blockNumber: this.blockCounter,
        transactionHash: transactionHash,
        timestamp,
        verified: true,
      };

      // Store in our simulated blockchain
      this.storedRecords.set(transactionHash, blockchainRecord);
      this.storedRecords.set(hash, blockchainRecord); // Also index by hash for verification

      console.log(`✅ Blockchain: Stored payroll record for ${record.employeeName}`);
      console.log(`   Transaction: ${transactionHash}`);
      console.log(`   Block: ${this.blockCounter}`);
      console.log(`   Hash: ${hash}`);

      return blockchainRecord;
    } catch (error) {
      console.error('Failed to store payroll record on blockchain:', error);
      throw new Error('Blockchain storage failed');
    }
  }

  /**
   * Verify payroll record against blockchain (simulated)
   */
  async verifyPayrollRecord(recordId: string, expectedHash: string): Promise<BlockchainVerification> {
    try {
      // Look up the record in our simulated blockchain
      const storedRecord = this.storedRecords.get(expectedHash);

      if (!storedRecord) {
        console.log(`❌ Blockchain: Record not found for hash ${expectedHash}`);
        throw new Error('Record verification failed - record not found on blockchain');
      }

      // Verify the hash matches
      const isVerified = storedRecord.blockchainHash === expectedHash;

      if (!isVerified) {
        console.log(`❌ Blockchain: Hash mismatch for record ${recordId}`);
        throw new Error('Record verification failed - hash mismatch');
      }

      console.log(`✅ Blockchain: Verified record ${recordId}`);
      console.log(`   Block: ${storedRecord.blockNumber}`);
      console.log(`   Transaction: ${storedRecord.transactionHash}`);

      return {
        recordId,
        isVerified: true,
        blockNumber: storedRecord.blockNumber,
        transactionHash: storedRecord.transactionHash,
        verificationDate: new Date().toISOString(),
        verifierAddress: blockchainConfig.contractAddress || '0x' + '0'.repeat(40),
      };
    } catch (error) {
      console.error('Failed to verify payroll record:', error);
      throw error;
    }
  }

  /**
   * Get blockchain record details (simulated)
   */
  async getBlockchainRecord(transactionHash: string): Promise<any> {
    try {
      // Look up the record in our simulated blockchain
      const storedRecord = this.storedRecords.get(transactionHash);

      if (!storedRecord) {
        throw new Error('Transaction not found on blockchain');
      }

      console.log(`📋 Blockchain: Retrieved record for transaction ${transactionHash}`);

      return {
        transactionHash: storedRecord.transactionHash,
        blockNumber: storedRecord.blockNumber,
        timestamp: storedRecord.timestamp,
        gasUsed: 21000 + (storedRecord.employeeName.length * 100), // Deterministic gas based on data size
        status: true,
        from: blockchainConfig.contractAddress || '0x' + '0'.repeat(40),
        to: blockchainConfig.contractAddress || '0x' + '0'.repeat(40),
        data: {
          employeeId: storedRecord.employeeId,
          employeeName: storedRecord.employeeName,
          netPay: storedRecord.netPay,
          hash: storedRecord.blockchainHash,
        }
      };
    } catch (error) {
      console.error('Failed to get blockchain record:', error);
      throw error;
    }
  }

  /**
   * Batch store multiple payroll records
   */
  async batchStorePayrollRecords(records: Omit<BlockchainPayrollRecord, 'blockchainHash' | 'blockNumber' | 'transactionHash' | 'timestamp' | 'verified'>[]): Promise<BlockchainPayrollRecord[]> {
    const results: BlockchainPayrollRecord[] = [];

    for (const record of records) {
      try {
        const blockchainRecord = await this.storePayrollRecord(record);
        results.push(blockchainRecord);
      } catch (error) {
        console.error(`Failed to store record for employee ${record.employeeId}:`, error);
        // Continue with other records even if one fails
      }
    }

    return results;
  }
}

// Export singleton instance
export const blockchainService = new BlockchainService();
