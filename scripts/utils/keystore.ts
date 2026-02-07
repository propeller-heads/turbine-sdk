import * as fs from "fs";
import * as path from "path";
import prompts from "prompts";
import { Account, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { Keystore, Address, Secp256k1 } from "ox";

/**
 * Load and decrypt a keystore file with password prompt
 * @param keystorePath Path to the keystore file (relative or absolute)
 * @param password Optional password (will prompt if not provided)
 * @returns Decrypted Account object
 */
export async function loadAccount(
    keystorePath: string,
    password?: string
): Promise<Account> {
    // Resolve path
    const resolvedPath = path.isAbsolute(keystorePath)
        ? keystorePath
        : path.resolve(process.cwd(), keystorePath);

    // Check file exists
    if (!fs.existsSync(resolvedPath)) {
        throw new Error(
            `Keystore not found at ${resolvedPath}. Run 'yarn create-keystore' to set up.`
        );
    }

    // Check file permissions (Unix only)
    if (process.platform !== "win32") {
        const stats = fs.statSync(resolvedPath);
        const mode = stats.mode & 0o777;
        if (mode !== 0o600) {
            console.warn(
                `⚠️  Warning: Keystore file has insecure permissions (${mode.toString(
                    8
                )}). Consider running: chmod 600 ${resolvedPath}`
            );
        }
    }

    // Read keystore
    let keystoreJson: string;
    try {
        keystoreJson = fs.readFileSync(resolvedPath, "utf8");
    } catch (error: any) {
        if (error.code === "EACCES") {
            throw new Error(
                `Cannot read keystore file. Check file permissions: ${resolvedPath}`
            );
        }
        throw error;
    }

    // Parse and validate JSON
    let keystoreObj: any;
    try {
        keystoreObj = JSON.parse(keystoreJson);
    } catch {
        throw new Error(
            `Keystore file is corrupted or invalid. Please check the file or create a new one: ${resolvedPath}`
        );
    }

    // Validate version
    if (keystoreObj.version !== 3) {
        throw new Error(
            `Keystore format version ${keystoreObj.version} not supported. Expected version 3.`
        );
    }

    // Decrypt keystore with retry loop
    while (true) {
        let pwd = password;

        // Prompt for password if not provided (outside try-catch to allow process.exit to propagate)
        if (!pwd) {
            const response = await prompts({
                type: "password",
                name: "password",
                message: "🔑 Enter keystore password:",
            });

            // Handle Ctrl+C
            if (!response.password) {
                console.log("\n❌ Operation cancelled");
                process.exit(1);
            }

            pwd = response.password;
        }

        if (!pwd) {
            throw new Error("Password is required");
        }

        // Try to decrypt
        try {
            // Decrypt using ox
            const key = Keystore.toKey(keystoreObj, { password: pwd });
            const privateKey = Keystore.decrypt(keystoreObj, key) as Hex;
            const account = privateKeyToAccount(privateKey);

            return account;
        } catch (error: any) {
            if (!password) {
                // Allow retry if password was prompted
                console.error(
                    "❌ Failed to decrypt keystore. Incorrect password? Try again."
                );
                continue;
            } else {
                // If password was provided programmatically, throw
                throw new Error(
                    `Failed to decrypt keystore. Incorrect password or corrupted file: ${resolvedPath}`
                );
            }
        }
    }
}

/**
 * Scan for keystores in the default directory
 */
function findKeystores(directory: string = "scripts/.keystores"): string[] {
    const resolvedDir = path.resolve(process.cwd(), directory);

    if (!fs.existsSync(resolvedDir)) {
        return [];
    }

    return fs
        .readdirSync(resolvedDir)
        .filter((file) => file.endsWith(".json") && !file.startsWith("EXAMPLE"))
        .map((file) => path.join(resolvedDir, file));
}

/**
 * Prompt user to select from available keystores
 */
async function selectKeystoreInteractive(keystores: string[]): Promise<string> {
    const choices = keystores.map((ks, index) => ({
        title: path.basename(ks),
        value: ks,
    }));

    const response = await prompts({
        type: "select",
        name: "keystore",
        message: "🔐 Select keystore:",
        choices: choices,
    });

    // Handle Ctrl+C
    if (!response.keystore) {
        console.log("\n❌ Operation cancelled");
        process.exit(1);
    }

    return response.keystore;
}

/**
 * Interactive: prompt user to select from available keystores
 * @returns Decrypted Account object
 */
export async function selectAndLoadAccount(): Promise<Account> {
    const keystores = findKeystores();

    if (keystores.length === 0) {
        throw new Error(
            "No keystores found. Run 'yarn create-keystore' or 'yarn migrate-env-to-keystore' to set up."
        );
    }

    if (keystores.length === 1) {
        console.log(`📁 Using keystore: ${path.basename(keystores[0])}`);
        return loadAccount(keystores[0]);
    }

    const selected = await selectKeystoreInteractive(keystores);
    return loadAccount(selected);
}

/**
 * Create a new encrypted keystore file
 * @param privateKey Private key to encrypt
 * @param password Password for encryption
 * @param outputPath Path where keystore will be saved
 * @param options Optional scrypt parameters (for testing - use defaults in production)
 */
export async function createKeystore(
    privateKey: Hex,
    password: string,
    outputPath: string,
    options?: { n?: number; r?: number; p?: number }
): Promise<void> {
    // Validate private key format
    if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
        throw new Error(
            "Invalid private key format. Expected 0x followed by 64 hex characters."
        );
    }

    // Validate password strength
    if (password.length < 12) {
        throw new Error(
            "Password must be at least 12 characters long for strong protection."
        );
    }

    // Derive address from private key
    const publicKey = Secp256k1.getPublicKey({ privateKey });
    const address = Address.fromPublicKey(publicKey);

    // Encrypt with V3 keystore format using scrypt
    // Use provided options for testing, otherwise use secure defaults
    const [key, opts] = Keystore.scrypt({
        password,
        n: options?.n ?? 262144, // Default: 262144 (secure)
        r: options?.r ?? 8,
        p: options?.p ?? 1,
    });
    const keystoreObj = Keystore.encrypt(privateKey, key, opts);

    // Add address field (without 0x prefix) for compatibility
    const keystoreWithAddress = {
        ...keystoreObj,
        address: address.slice(2).toLowerCase(),
    };
    const keystoreJson = JSON.stringify(keystoreWithAddress);

    // Ensure output directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // Write keystore file
    fs.writeFileSync(outputPath, keystoreJson, "utf8");

    // Set file permissions to 0600 (owner read/write only) on Unix systems
    if (process.platform !== "win32") {
        fs.chmodSync(outputPath, 0o600);
    }

    console.log(`✅ Keystore created: ${outputPath}`);
    console.log(`📍 Address: ${address}`);
}

/**
 * Helper to get account from env var or keystore
 * This is the pattern scripts should use for backward compatibility
 */
export async function getAccount(): Promise<Account> {
    // Try environment variable first (for CI)
    if (process.env.PRIVATE_KEY) {
        const privateKey = process.env.PRIVATE_KEY as Hex;
        return privateKeyToAccount(privateKey);
    }

    // Fall back to keystore
    return selectAndLoadAccount();
}
