import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
    loadAccount,
    selectAndLoadAccount,
    createKeystore,
    getAccount,
} from "../scripts/utils/keystore";

// Mock prompts for interactive CLI testing
jest.mock("prompts");
import prompts from "prompts";
const mockPrompts = prompts as jest.MockedFunction<typeof prompts>;

describe("keystore", () => {
    let tempDir: string;
    let originalCwd: string;
    let originalEnv: NodeJS.ProcessEnv;

    // Test private key (from Hardhat test accounts)
    const TEST_PRIVATE_KEY =
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
    const TEST_PASSWORD = "test-password-123";
    const WEAK_PASSWORD = "weak";

    // Fast scrypt parameters for testing (n=64 instead of 262144)
    // This makes tests ~4000x faster while still testing the logic
    // n=64 is insecure for production but sufficient to test code paths
    const TEST_SCRYPT_PARAMS = { n: 64, r: 1, p: 1 };

    beforeAll(() => {
        // Create ONE temporary directory for all tests
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "keystore-test-"));
        originalCwd = process.cwd();
        process.chdir(tempDir);

        // Save environment
        originalEnv = { ...process.env };

        // Create .keystores directory once
        fs.mkdirSync(path.join(tempDir, "scripts", ".keystores"), { recursive: true });
    });

    beforeEach(() => {
        // Clear environment for each test
        delete process.env.PRIVATE_KEY;

        // Clean up any keystores from previous test (much faster than recreating directory)
        const keystoreDir = path.join(tempDir, "scripts", ".keystores");
        if (fs.existsSync(keystoreDir)) {
            const files = fs.readdirSync(keystoreDir);
            for (const file of files) {
                if (file.endsWith(".json")) {
                    fs.unlinkSync(path.join(keystoreDir, file));
                }
            }
        }

        // Reset mocks
        jest.clearAllMocks();
    });

    afterEach(() => {
        // Restore environment
        process.env = originalEnv;
    });

    afterAll(() => {
        // Restore working directory
        process.chdir(originalCwd);

        // Clean up temp directory once at the end
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe("createKeystore", () => {
        it("should create a valid V3 keystore file", async () => {
            const keystorePath = path.join(tempDir, "scripts/.keystores/test.json");

            await createKeystore(
                TEST_PRIVATE_KEY,
                TEST_PASSWORD,
                keystorePath,
                TEST_SCRYPT_PARAMS
            );

            // File should exist
            expect(fs.existsSync(keystorePath)).toBe(true);

            // Should be valid JSON
            const keystoreContent = fs.readFileSync(keystorePath, "utf8");
            const keystore = JSON.parse(keystoreContent);

            // Should have V3 format
            expect(keystore.version).toBe(3);
            expect(keystore.crypto).toBeDefined();
            expect(keystore.crypto.kdf).toBe("scrypt");
            // Using test parameters (fast)
            expect(keystore.crypto.kdfparams.n).toBe(TEST_SCRYPT_PARAMS.n);
            expect(keystore.crypto.kdfparams.r).toBe(TEST_SCRYPT_PARAMS.r);
            expect(keystore.crypto.kdfparams.p).toBe(TEST_SCRYPT_PARAMS.p);
            expect(keystore.address).toBeDefined();
        });

        it("should set file permissions to 0600 on Unix", async () => {
            if (process.platform === "win32") {
                // Skip on Windows
                return;
            }

            const keystorePath = path.join(tempDir, "scripts/.keystores/test.json");
            await createKeystore(
                TEST_PRIVATE_KEY,
                TEST_PASSWORD,
                keystorePath,
                TEST_SCRYPT_PARAMS
            );

            const stats = fs.statSync(keystorePath);
            const mode = stats.mode & 0o777;
            expect(mode).toBe(0o600);
        });

        it("should reject invalid private key format", async () => {
            const keystorePath = path.join(tempDir, "scripts/.keystores/test.json");

            await expect(
                createKeystore("invalid-key" as Hex, TEST_PASSWORD, keystorePath)
            ).rejects.toThrow("Invalid private key format");

            await expect(
                createKeystore("0x123" as Hex, TEST_PASSWORD, keystorePath)
            ).rejects.toThrow("Invalid private key format");
        });

        it("should reject weak passwords", async () => {
            const keystorePath = path.join(tempDir, "scripts/.keystores/test.json");

            await expect(
                createKeystore(TEST_PRIVATE_KEY, WEAK_PASSWORD, keystorePath)
            ).rejects.toThrow("at least 12 characters");
        });

        it("should create parent directory if it doesn't exist", async () => {
            const keystorePath = path.join(
                tempDir,
                "new-dir",
                "nested",
                "keystore.json"
            );

            await createKeystore(
                TEST_PRIVATE_KEY,
                TEST_PASSWORD,
                keystorePath,
                TEST_SCRYPT_PARAMS
            );

            expect(fs.existsSync(keystorePath)).toBe(true);
        });
    });

    describe("loadAccount", () => {
        let keystorePath: string;

        beforeEach(async () => {
            // Create a test keystore
            keystorePath = path.join(tempDir, "scripts/.keystores/test.json");
            await createKeystore(
                TEST_PRIVATE_KEY,
                TEST_PASSWORD,
                keystorePath,
                TEST_SCRYPT_PARAMS
            );
        });

        it("should load and decrypt a valid keystore with correct password", async () => {
            const account = await loadAccount(keystorePath, TEST_PASSWORD);

            expect(account).toBeDefined();
            expect(account.address).toBeDefined();
            expect(account.address.startsWith("0x")).toBe(true);
            // Verify it matches the expected address for this private key
            const expectedAccount = privateKeyToAccount(TEST_PRIVATE_KEY);
            expect(account.address).toBe(expectedAccount.address);
        });

        it("should throw error for incorrect password when password is provided", async () => {
            await expect(loadAccount(keystorePath, "wrong-password")).rejects.toThrow(
                "Failed to decrypt keystore"
            );
        });

        it("should throw error for missing keystore file", async () => {
            await expect(
                loadAccount("nonexistent.json", TEST_PASSWORD)
            ).rejects.toThrow("Keystore not found");
        });

        it("should throw error for corrupted JSON", async () => {
            const corruptedPath = path.join(
                tempDir,
                "scripts/.keystores/corrupted.json"
            );
            fs.writeFileSync(corruptedPath, "not valid json", "utf8");

            await expect(loadAccount(corruptedPath, TEST_PASSWORD)).rejects.toThrow(
                "corrupted or invalid"
            );
        });

        it("should throw error for wrong version", async () => {
            const wrongVersionPath = path.join(
                tempDir,
                "scripts/.keystores/wrong-version.json"
            );
            fs.writeFileSync(
                wrongVersionPath,
                JSON.stringify({ version: 2, crypto: {} }),
                "utf8"
            );

            await expect(loadAccount(wrongVersionPath, TEST_PASSWORD)).rejects.toThrow(
                "version 2 not supported"
            );
        });

        it("should decrypt the same keystore consistently", async () => {
            const account1 = await loadAccount(keystorePath, TEST_PASSWORD);
            const account2 = await loadAccount(keystorePath, TEST_PASSWORD);

            // Should return equivalent accounts with the same address
            expect(account1.address).toBe(account2.address);
            expect(account1.address).toBeDefined();
        });

        it("should handle relative paths", async () => {
            const account = await loadAccount(
                "scripts/.keystores/test.json",
                TEST_PASSWORD
            );

            expect(account).toBeDefined();
            expect(account.address).toBeDefined();
            // Verify it matches the expected address
            const expectedAccount = privateKeyToAccount(TEST_PRIVATE_KEY);
            expect(account.address).toBe(expectedAccount.address);
        });

        it("should prompt for password when not provided", async () => {
            mockPrompts.mockResolvedValueOnce({ password: TEST_PASSWORD });

            const account = await loadAccount(keystorePath);

            expect(account).toBeDefined();
            expect(mockPrompts).toHaveBeenCalledWith({
                type: "password",
                name: "password",
                message: "🔑 Enter keystore password:",
            });
        });

        it("should retry on incorrect password when prompting", async () => {
            // First wrong password, then correct
            mockPrompts
                .mockResolvedValueOnce({ password: "wrong-password" })
                .mockResolvedValueOnce({ password: TEST_PASSWORD });

            const account = await loadAccount(keystorePath);

            expect(account).toBeDefined();
            expect(mockPrompts).toHaveBeenCalledTimes(2);
        });

        it("should exit on Ctrl+C during password prompt", async () => {
            const mockExit = jest.spyOn(process, "exit").mockImplementation((() => {
                throw new Error("process.exit called");
            }) as any);

            // User cancels (Ctrl+C returns undefined password)
            mockPrompts.mockResolvedValueOnce({ password: undefined });

            await expect(loadAccount(keystorePath)).rejects.toThrow(
                "process.exit called"
            );

            expect(mockExit).toHaveBeenCalledWith(1);
            mockExit.mockRestore();
        });
    });

    describe("selectAndLoadAccount", () => {
        it("should throw error when no keystores found", async () => {
            await expect(selectAndLoadAccount()).rejects.toThrow("No keystores found");
        });

        it("should auto-select when only one keystore exists", async () => {
            const keystorePath = path.join(tempDir, "scripts/.keystores/test.json");
            await createKeystore(
                TEST_PRIVATE_KEY,
                TEST_PASSWORD,
                keystorePath,
                TEST_SCRYPT_PARAMS
            );

            mockPrompts.mockResolvedValueOnce({ password: TEST_PASSWORD });

            const account = await selectAndLoadAccount();

            expect(account).toBeDefined();
            // Should not prompt for keystore selection
            expect(mockPrompts).toHaveBeenCalledTimes(1);
            expect(mockPrompts).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "password",
                })
            );
        });

        it("should prompt for selection when multiple keystores exist", async () => {
            const keystore1 = path.join(tempDir, "scripts/.keystores/account1.json");
            const keystore2 = path.join(tempDir, "scripts/.keystores/account2.json");

            await createKeystore(
                TEST_PRIVATE_KEY,
                TEST_PASSWORD,
                keystore1,
                TEST_SCRYPT_PARAMS
            );
            await createKeystore(
                TEST_PRIVATE_KEY,
                TEST_PASSWORD,
                keystore2,
                TEST_SCRYPT_PARAMS
            );

            // Mock selecting the first keystore, then password
            mockPrompts
                .mockResolvedValueOnce({ keystore: keystore1 })
                .mockResolvedValueOnce({ password: TEST_PASSWORD });

            const account = await selectAndLoadAccount();

            expect(account).toBeDefined();
            expect(mockPrompts).toHaveBeenCalledTimes(2);

            // First call should be keystore selection
            expect(mockPrompts).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    type: "select",
                    message: "🔐 Select keystore:",
                })
            );
        });

        it("should ignore EXAMPLE keystores", async () => {
            const examplePath = path.join(
                tempDir,
                "scripts/.keystores/EXAMPLE-DO-NOT-USE.json"
            );
            const validPath = path.join(tempDir, "scripts/.keystores/valid.json");

            fs.writeFileSync(examplePath, JSON.stringify({ version: 3 }), "utf8");
            await createKeystore(
                TEST_PRIVATE_KEY,
                TEST_PASSWORD,
                validPath,
                TEST_SCRYPT_PARAMS
            );

            mockPrompts.mockResolvedValueOnce({ password: TEST_PASSWORD });

            const account = await selectAndLoadAccount();

            expect(account).toBeDefined();
            // Should auto-select the only valid keystore (ignoring EXAMPLE)
            expect(mockPrompts).toHaveBeenCalledTimes(1);
        });

        it("should exit on Ctrl+C during keystore selection", async () => {
            const mockExit = jest.spyOn(process, "exit").mockImplementation((() => {
                throw new Error("process.exit called");
            }) as any);

            const keystore1 = path.join(tempDir, "scripts/.keystores/account1.json");
            const keystore2 = path.join(tempDir, "scripts/.keystores/account2.json");

            await createKeystore(
                TEST_PRIVATE_KEY,
                TEST_PASSWORD,
                keystore1,
                TEST_SCRYPT_PARAMS
            );
            await createKeystore(
                TEST_PRIVATE_KEY,
                TEST_PASSWORD,
                keystore2,
                TEST_SCRYPT_PARAMS
            );

            // User cancels selection
            mockPrompts.mockResolvedValueOnce({ keystore: undefined });

            await expect(selectAndLoadAccount()).rejects.toThrow("process.exit called");

            expect(mockExit).toHaveBeenCalledWith(1);
            mockExit.mockRestore();
        });
    });

    describe("getAccount", () => {
        it("should use PRIVATE_KEY environment variable if set", async () => {
            process.env.PRIVATE_KEY = TEST_PRIVATE_KEY;

            const account = await getAccount();

            expect(account).toBeDefined();
            expect(account.address).toBe(privateKeyToAccount(TEST_PRIVATE_KEY).address);

            // Should not call prompts or look for keystores
            expect(mockPrompts).not.toHaveBeenCalled();
        });

        it("should fall back to keystore when PRIVATE_KEY not set", async () => {
            delete process.env.PRIVATE_KEY;

            const keystorePath = path.join(tempDir, "scripts/.keystores/test.json");
            await createKeystore(
                TEST_PRIVATE_KEY,
                TEST_PASSWORD,
                keystorePath,
                TEST_SCRYPT_PARAMS
            );

            mockPrompts.mockResolvedValueOnce({ password: TEST_PASSWORD });

            const account = await getAccount();

            expect(account).toBeDefined();
            expect(mockPrompts).toHaveBeenCalled();
        });

        it("should throw when no PRIVATE_KEY and no keystores", async () => {
            delete process.env.PRIVATE_KEY;

            await expect(getAccount()).rejects.toThrow("No keystores found");
        });
    });

    describe("integration", () => {
        it("should create, save, and load a keystore end-to-end", async () => {
            const keystorePath = path.join(tempDir, "scripts/.keystores/e2e-test.json");

            // Create keystore
            await createKeystore(
                TEST_PRIVATE_KEY,
                TEST_PASSWORD,
                keystorePath,
                TEST_SCRYPT_PARAMS
            );

            // Verify file exists and is valid JSON
            expect(fs.existsSync(keystorePath)).toBe(true);
            const keystoreContent = fs.readFileSync(keystorePath, "utf8");
            const keystore = JSON.parse(keystoreContent);
            expect(keystore.version).toBe(3);

            // Load it back
            const account = await loadAccount(keystorePath, TEST_PASSWORD);

            // Verify we got a valid account
            expect(account).toBeDefined();
            expect(account.address).toBeDefined();
            expect(account.address.startsWith("0x")).toBe(true);
        });

        it("should work with different valid private keys", async () => {
            const testKeys = [
                "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
                "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
                "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
            ] as Hex[];

            for (let i = 0; i < testKeys.length; i++) {
                const keystorePath = path.join(
                    tempDir,
                    `scripts/.keystores/key${i}.json`
                );
                await createKeystore(
                    testKeys[i],
                    TEST_PASSWORD,
                    keystorePath,
                    TEST_SCRYPT_PARAMS
                );

                // Verify keystore was created
                expect(fs.existsSync(keystorePath)).toBe(true);

                const account = await loadAccount(keystorePath, TEST_PASSWORD);

                // Verify we got a valid account matching the original key
                expect(account).toBeDefined();
                expect(account.address).toBeDefined();
                const expectedAccount = privateKeyToAccount(testKeys[i]);
                expect(account.address).toBe(expectedAccount.address);
            }
        });

        it("should handle EACCES error when reading keystore", async () => {
            if (process.platform === "win32") {
                // Skip on Windows (different permission model)
                return;
            }

            const keystorePath = path.join(tempDir, "scripts/.keystores/noaccess.json");
            await createKeystore(
                TEST_PRIVATE_KEY,
                TEST_PASSWORD,
                keystorePath,
                TEST_SCRYPT_PARAMS
            );

            // Make file unreadable
            fs.chmodSync(keystorePath, 0o000);

            await expect(loadAccount(keystorePath, TEST_PASSWORD)).rejects.toThrow(
                "Check file permissions"
            );

            // Restore permissions for cleanup
            fs.chmodSync(keystorePath, 0o600);
        });
    });
});
