#!/usr/bin/env ts-node

/**
 * Create a new encrypted keystore file for securely storing private keys.
 *
 * This script creates an encrypted JSON keystore file compatible with Ethereum standards.
 * The keystore uses scrypt KDF for strong password-based encryption.
 *
 * Usage:
 *   yarn create-keystore
 *   or
 *   ts-node scripts/create-keystore.ts
 *
 * The script will interactively prompt for:
 *   1. Keystore filename
 *   2. Private key (masked input)
 *   3. Password (masked input, min 12 characters)
 *   4. Password confirmation
 *
 * Security Notes:
 *   - Private key input is masked and never logged
 *   - Keystore is encrypted with scrypt (n=262144, r=8, p=1)
 *   - File permissions are set to 0600 (owner read/write only) on Unix systems
 *   - Password must be at least 12 characters
 *   - Back up your keystore file securely - it's your only copy after deleting the original key
 */

import { Hex } from "viem";
import prompts from "prompts";
import * as fs from "fs";
import * as path from "path";
import { createKeystore } from "./utils/keystore";

async function main() {
    console.log("🔐 Create Encrypted Keystore");
    console.log("════════════════════════════\n");

    // Step 1: Get keystore name
    console.log("Step 1: Choose a filename for your keystore\n");

    const defaultName = "default.json";
    const nameResponse = await prompts({
        type: "text",
        name: "filename",
        message: "📁 Keystore filename:",
        initial: defaultName,
    });

    if (!nameResponse.filename) {
        console.log("\n❌ Operation cancelled");
        process.exit(1);
    }

    const filename = nameResponse.filename.trim() || defaultName;
    const finalFilename = filename.endsWith(".json") ? filename : `${filename}.json`;
    const outputPath = path.resolve(process.cwd(), "scripts/.keystores", finalFilename);

    if (fs.existsSync(outputPath)) {
        console.error(`\n❌ Keystore already exists: ${outputPath}`);
        console.error("Choose a different filename or delete the existing file first.");
        process.exit(1);
    }

    // Step 2: Get private key
    console.log("\nStep 2: Enter your private key");
    console.log("(Input will be masked for security)\n");

    const keyResponse = await prompts({
        type: "password",
        name: "privateKey",
        message: "🔑 Private key (with 0x prefix):",
        validate: (value) => {
            if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
                return "Invalid private key format. Expected 0x followed by 64 hex characters.";
            }
            return true;
        },
    });

    if (!keyResponse.privateKey) {
        console.log("\n❌ Operation cancelled");
        process.exit(1);
    }

    const privateKey = keyResponse.privateKey;

    // Step 3: Get password
    console.log("\nStep 3: Choose a strong password");
    console.log("(Minimum 12 characters recommended)\n");

    let password: string;

    while (true) {
        const pwdResponse = await prompts([
            {
                type: "password",
                name: "password",
                message: "🔒 Password:",
                validate: (value) => {
                    if (value.length < 12) {
                        return "Password should be at least 12 characters for strong protection.";
                    }
                    return true;
                },
            },
            {
                type: "password",
                name: "confirm",
                message: "🔒 Confirm password:",
            },
        ]);

        if (!pwdResponse.password || !pwdResponse.confirm) {
            console.log("\n❌ Operation cancelled");
            process.exit(1);
        }

        if (pwdResponse.password === pwdResponse.confirm) {
            password = pwdResponse.password;
            break;
        } else {
            console.log("\n❌ Passwords do not match. Please try again.\n");
        }
    }

    // Step 4: Create keystore
    console.log("\n🔄 Creating encrypted keystore...");
    console.log("(This may take a few seconds due to secure key derivation)\n");

    try {
        await createKeystore(privateKey as Hex, password, outputPath);

        console.log("\n✅ SUCCESS! Keystore created successfully.");
        console.log("\n📋 Important next steps:");
        console.log(
            "   1. ⚠️  DELETE the original plaintext private key source securely"
        );
        console.log("   2. 💾 BACK UP this keystore file to a secure location");
        console.log("   3. 🔒 Remember your password - it cannot be recovered if lost");
        console.log(
            "\n💡 You can now run scripts without PRIVATE_KEY environment variable."
        );
        console.log("   The keystore will be automatically detected and used.");
    } catch (error: any) {
        console.error("\n❌ Error creating keystore:");
        console.error(error.message);
        process.exit(1);
    }
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
    process.exit(1);
});

main().catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
});
