#!/usr/bin/env ts-node

/**
 * Migrate from PRIVATE_KEY environment variable to encrypted keystore.
 *
 * This script helps users transition from storing private keys in environment variables
 * to using encrypted keystore files for improved security.
 *
 * Usage:
 *   yarn migrate-env-to-keystore
 *   or
 *   ts-node scripts/migrate-env-to-keystore.ts
 *
 * The script will:
 *   1. Read PRIVATE_KEY from environment (or prompt if not set)
 *   2. Prompt for encryption password
 *   3. Create encrypted keystore file
 *   4. Provide instructions for cleanup
 *
 * Security Notes:
 *   - After migration, remove PRIVATE_KEY from .env files
 *   - Unset PRIVATE_KEY in your current shell
 *   - Back up the keystore file securely
 *   - Never commit .env files to version control
 */

import { Hex } from "viem";
import prompts from "prompts";
import * as path from "path";
import { createKeystore } from "./utils/keystore";

async function main() {
    console.log("🔄 Migrate to Encrypted Keystore");
    console.log("═════════════════════════════════\n");

    // Step 1: Get private key from env or prompt
    let privateKey = process.env.PRIVATE_KEY;

    if (!privateKey) {
        console.log("⚠️  PRIVATE_KEY environment variable not found.");
        console.log("You can:");
        console.log("  1. Set PRIVATE_KEY temporarily and run this script again");
        console.log("  2. Enter your private key manually now\n");

        const choiceResponse = await prompts({
            type: "confirm",
            name: "manual",
            message: "Enter private key manually?",
            initial: false,
        });

        if (!choiceResponse.manual) {
            console.log("\n💡 To set PRIVATE_KEY temporarily:");
            console.log('   export PRIVATE_KEY="0x..."');
            console.log("   yarn migrate-env-to-keystore\n");
            process.exit(0);
        }

        console.log("\n(Input will be masked for security)\n");

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

        privateKey = keyResponse.privateKey;
    } else {
        console.log("✅ Found PRIVATE_KEY in environment\n");
    }

    // Validate private key format (TypeScript narrowing: ensure privateKey is string)
    if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
        console.error(
            "❌ Error: Invalid private key format. Expected 0x followed by 64 hex characters."
        );
        process.exit(1);
    }

    // Step 2: Get password
    console.log("Step 1: Choose a strong password for encryption");
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

    // Step 3: Get keystore name
    console.log("\nStep 2: Choose a filename for your keystore\n");

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

    // Ensure .json extension
    const finalFilename = filename.endsWith(".json") ? filename : `${filename}.json`;

    const outputPath = path.resolve(process.cwd(), "scripts/.keystores", finalFilename);

    // Step 4: Create keystore
    console.log("\n🔄 Creating encrypted keystore...");
    console.log("(This may take a few seconds due to secure key derivation)\n");

    try {
        await createKeystore(privateKey as Hex, password, outputPath);

        console.log("\n✅ SUCCESS! Migration complete.");
        console.log("\n📋 IMPORTANT: Complete these security steps:");
        console.log("\n1. Remove PRIVATE_KEY from .env file:");
        console.log("   - Open your .env file");
        console.log("   - Delete the line with PRIVATE_KEY");
        console.log("   - Save the file");
        console.log("\n2. Remove PRIVATE_KEY from .env.example (if present):");
        console.log("   - Open .env.example");
        console.log("   - Delete any lines showing PRIVATE_KEY");
        console.log("   - Save the file");
        console.log("\n3. Unset PRIVATE_KEY in your current shell:");
        console.log("   unset PRIVATE_KEY");
        console.log("\n4. Back up your keystore file securely:");
        console.log(`   ${outputPath}`);
        console.log("\n5. Remember your password - it cannot be recovered if lost");
        console.log(
            "\n💡 You can now run scripts without PRIVATE_KEY environment variable."
        );
        console.log("   The keystore will be automatically detected and used.");
        console.log("\n⚠️  SECURITY WARNING:");
        console.log(
            "   Never commit .env files to version control. Use GitHub Secrets,"
        );
        console.log("   AWS Secrets Manager, or similar for CI/CD pipelines.");
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
