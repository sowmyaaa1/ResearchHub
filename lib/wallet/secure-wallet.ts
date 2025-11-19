// Secure key management for ResearchHub
// Supports HashPack wallet connection and encrypted key storage
// NEVER stores raw private keys in backend

import { Client, PrivateKey, AccountId, PublicKey } from '@hashgraph/sdk';

export interface WalletConnection {
  accountId: string;
  publicKey: string;
  connectionType: 'hashpack' | 'encrypted_key';
  encryptedKeyBlob?: string; // Only for encrypted key storage
}

export interface EncryptedKeyData {
  encryptedPrivateKey: string;
  iv: string;
  salt: string;
  algorithm: string;
}

export interface HashPackAccountInfo {
  accountId: string;
  publicKey: string;
  network: 'testnet' | 'mainnet';
}

declare global {
  interface Window {
    hashpack?: {
      connectToLocalWallet: () => Promise<{
        accountIds: string[];
        network: string;
        publicKey?: string;
      }>;
      sendTransaction: (transaction: any) => Promise<{
        receipt: any;
        response: any;
      }>;
      requestAccountInfo: () => Promise<HashPackAccountInfo>;
      disconnect: () => void;
    };
  }
}

/**
 * HashPack wallet integration for secure transaction signing
 */
export class HashPackWallet {
  private isConnected = false;
  private accountInfo: HashPackAccountInfo | null = null;

  /**
   * Check if HashPack extension is available
   */
  static isAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.hashpack;
  }

  /**
   * Connect to HashPack wallet
   */
  async connect(): Promise<WalletConnection> {
    if (!HashPackWallet.isAvailable()) {
      throw new Error('HashPack wallet extension not found. Please install HashPack.');
    }

    try {
      const connectionData = await window.hashpack!.connectToLocalWallet();
      
      if (!connectionData.accountIds || connectionData.accountIds.length === 0) {
        throw new Error('No accounts found in HashPack wallet');
      }

      // Get detailed account info
      this.accountInfo = await window.hashpack!.requestAccountInfo();
      this.isConnected = true;

      return {
        accountId: this.accountInfo.accountId,
        publicKey: this.accountInfo.publicKey,
        connectionType: 'hashpack'
      };

    } catch (error) {
      console.error('[HashPack] Connection failed:', error);
      throw new Error(`Failed to connect to HashPack: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Disconnect from HashPack wallet
   */
  disconnect(): void {
    if (window.hashpack) {
      window.hashpack.disconnect();
    }
    this.isConnected = false;
    this.accountInfo = null;
  }

  /**
   * Send transaction through HashPack for signing
   */
  async sendTransaction(transactionBytes: Uint8Array): Promise<{
    transactionId: string;
    receipt: any;
  }> {
    if (!this.isConnected || !window.hashpack) {
      throw new Error('HashPack wallet not connected');
    }

    try {
      const result = await window.hashpack.sendTransaction(transactionBytes);
      return {
        transactionId: result.response.transactionId,
        receipt: result.receipt
      };
    } catch (error) {
      console.error('[HashPack] Transaction failed:', error);
      throw new Error(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current account info
   */
  getAccountInfo(): HashPackAccountInfo | null {
    return this.accountInfo;
  }

  /**
   * Check if wallet is connected
   */
  isWalletConnected(): boolean {
    return this.isConnected;
  }
}

/**
 * Encrypted key storage using WebCrypto API
 * Keys are encrypted client-side and never exposed to backend
 */
export class EncryptedKeyManager {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12;
  private static readonly SALT_LENGTH = 16;

  /**
   * Encrypt a private key with a passphrase
   */
  static async encryptPrivateKey(
    privateKeyString: string,
    passphrase: string
  ): Promise<EncryptedKeyData> {
    try {
      // Generate salt and IV
      const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

      // Derive key from passphrase
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(passphrase),
        'PBKDF2',
        false,
        ['deriveKey']
      );

      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt,
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: this.ALGORITHM, length: this.KEY_LENGTH },
        false,
        ['encrypt']
      );

      // Encrypt private key
      const encodedPrivateKey = new TextEncoder().encode(privateKeyString);
      const encrypted = await crypto.subtle.encrypt(
        { name: this.ALGORITHM, iv },
        key,
        encodedPrivateKey
      );

      return {
        encryptedPrivateKey: this.arrayBufferToBase64(encrypted),
        iv: this.arrayBufferToBase64(iv.buffer),
        salt: this.arrayBufferToBase64(salt.buffer),
        algorithm: this.ALGORITHM,
      };
    } catch (error) {
      console.error('[EncryptedKey] Encryption failed:', error);
      throw new Error('Failed to encrypt private key');
    }
  }

  /**
   * Decrypt a private key with a passphrase
   */
  static async decryptPrivateKey(
    encryptedData: EncryptedKeyData,
    passphrase: string
  ): Promise<string> {
    try {
      // Convert base64 back to arrays
      const salt = this.base64ToArrayBuffer(encryptedData.salt);
      const iv = this.base64ToArrayBuffer(encryptedData.iv);
      const encrypted = this.base64ToArrayBuffer(encryptedData.encryptedPrivateKey);

      // Derive key from passphrase
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(passphrase),
        'PBKDF2',
        false,
        ['deriveKey']
      );

      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: new Uint8Array(salt),
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: encryptedData.algorithm, length: this.KEY_LENGTH },
        false,
        ['decrypt']
      );

      // Decrypt private key
      const decrypted = await crypto.subtle.decrypt(
        { name: encryptedData.algorithm, iv: new Uint8Array(iv) },
        key,
        encrypted
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('[EncryptedKey] Decryption failed:', error);
      throw new Error('Failed to decrypt private key - invalid passphrase or corrupted data');
    }
  }

  /**
   * Validate encrypted key format
   */
  static isValidEncryptedKey(data: any): data is EncryptedKeyData {
    return (
      typeof data === 'object' &&
      typeof data.encryptedPrivateKey === 'string' &&
      typeof data.iv === 'string' &&
      typeof data.salt === 'string' &&
      typeof data.algorithm === 'string'
    );
  }

  /**
   * Create a wallet connection with encrypted key storage
   */
  static async createEncryptedWallet(
    privateKeyString: string,
    passphrase: string,
    network: 'testnet' | 'mainnet' = 'testnet'
  ): Promise<WalletConnection> {
    try {
      // Validate private key
      const privateKey = PrivateKey.fromString(privateKeyString);
      const publicKey = privateKey.publicKey;
      const accountId = AccountId.fromEvmAddress(0, 0, '0x0000000000000000000000000000000000000000'); // Will be updated with actual account

      // Encrypt private key
      const encryptedData = await this.encryptPrivateKey(privateKeyString, passphrase);

      return {
        accountId: accountId.toString(),
        publicKey: publicKey.toString(),
        connectionType: 'encrypted_key',
        encryptedKeyBlob: JSON.stringify(encryptedData)
      };
    } catch (error) {
      console.error('[EncryptedKey] Wallet creation failed:', error);
      throw new Error('Failed to create encrypted wallet');
    }
  }

  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

/**
 * Transaction builder for secure signing
 */
export class SecureTransactionBuilder {
  private client: Client;
  private walletConnection: WalletConnection | null = null;
  private hashPackWallet?: HashPackWallet;

  constructor(network: 'testnet' | 'mainnet' = 'testnet') {
    this.client = network === 'testnet' ? Client.forTestnet() : Client.forMainnet();
  }

  /**
   * Set wallet connection for transaction signing
   */
  setWalletConnection(connection: WalletConnection): void {
    this.walletConnection = connection;
    
    if (connection.connectionType === 'hashpack') {
      this.hashPackWallet = new HashPackWallet();
    }
  }

  /**
   * Sign and execute transaction
   */
  async executeTransaction(
    transactionBuilder: any, // Hedera transaction builder
    passphrase?: string // Required for encrypted key connections
  ): Promise<{ transactionId: string; receipt: any }> {
    if (!this.walletConnection) {
      throw new Error('No wallet connection established');
    }

    try {
      if (this.walletConnection.connectionType === 'hashpack') {
        // Use HashPack for signing
        const transactionBytes = await transactionBuilder.toBytes();
        return await this.hashPackWallet!.sendTransaction(transactionBytes);
        
      } else if (this.walletConnection.connectionType === 'encrypted_key') {
        // Decrypt and use private key
        if (!passphrase || !this.walletConnection.encryptedKeyBlob) {
          throw new Error('Passphrase required for encrypted key signing');
        }

        const encryptedData = JSON.parse(this.walletConnection.encryptedKeyBlob);
        const privateKeyString = await EncryptedKeyManager.decryptPrivateKey(encryptedData, passphrase);
        const privateKey = PrivateKey.fromString(privateKeyString);
        
        // Set operator and execute transaction
        this.client.setOperator(AccountId.fromString(this.walletConnection.accountId), privateKey);
        const response = await transactionBuilder.execute(this.client);
        const receipt = await response.getReceipt(this.client);

        return {
          transactionId: response.transactionId.toString(),
          receipt
        };
      }

      throw new Error('Unsupported wallet connection type');
    } catch (error) {
      console.error('[SecureTransaction] Execution failed:', error);
      throw error;
    }
  }

  /**
   * Close client connection
   */
  close(): void {
    this.client.close();
  }
}

/**
 * Main wallet manager combining HashPack and encrypted key functionality
 */
export class WalletManager {
  private static instance: WalletManager;
  private currentConnection: WalletConnection | null = null;
  private transactionBuilder: SecureTransactionBuilder;

  private constructor() {
    this.transactionBuilder = new SecureTransactionBuilder();
  }

  static getInstance(): WalletManager {
    if (!this.instance) {
      this.instance = new WalletManager();
    }
    return this.instance;
  }

  /**
   * Connect using HashPack wallet
   */
  async connectHashPack(): Promise<WalletConnection> {
    const hashPackWallet = new HashPackWallet();
    const connection = await hashPackWallet.connect();
    this.currentConnection = connection;
    this.transactionBuilder.setWalletConnection(connection);
    return connection;
  }

  /**
   * Connect using encrypted private key
   */
  async connectEncryptedKey(privateKey: string, passphrase: string): Promise<WalletConnection> {
    const connection = await EncryptedKeyManager.createEncryptedWallet(privateKey, passphrase);
    this.currentConnection = connection;
    this.transactionBuilder.setWalletConnection(connection);
    return connection;
  }

  /**
   * Disconnect current wallet
   */
  disconnect(): void {
    this.currentConnection = null;
    // Clear any sensitive data from memory
  }

  /**
   * Get current wallet connection
   */
  getCurrentConnection(): WalletConnection | null {
    return this.currentConnection;
  }

  /**
   * Execute transaction with current wallet
   */
  async executeTransaction(transaction: any, passphrase?: string): Promise<{ transactionId: string; receipt: any }> {
    return await this.transactionBuilder.executeTransaction(transaction, passphrase);
  }

  /**
   * Check if wallet is connected
   */
  isConnected(): boolean {
    return this.currentConnection !== null;
  }
}