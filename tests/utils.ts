import { TurbineError } from "../src/errorHandling";

/**
 * Executes a closure and returns its return value. If the closure throws a TurbineError,
 * the helper will console.error its originalMessage.
 * @param closure The closure to execute
 * @returns The return value of the closure
 */
export async function withTurbineErrorHandling<T>(
    closure: () => Promise<T>
): Promise<T> {
    try {
        return await closure();
    } catch (error) {
        if (error instanceof TurbineError) {
            console.error(error.originalMessage);
        }
        throw error;
    }
}
