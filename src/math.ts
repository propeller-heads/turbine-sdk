export function bigIntSqrt(value: bigint): bigint {
    if (value < 0n) {
        throw new Error("square root of negative numbers is not supported");
    }
    if (value < 2n) {
        return value;
    }
    // Initial guess: 2^(bitLength/2)
    const bitLength = BigInt(value.toString(2).length);
    let x0 = 1n << ((bitLength + 1n) >> 1n);
    let x1 = (x0 + value / x0) >> 1n;
    while (x1 < x0) {
        x0 = x1;
        x1 = (x0 + value / x0) >> 1n;
    }
    return x0;
}

export function computeSqrtPriceX96(amountCurrency0: bigint, amountCurrency1: bigint): bigint {
    if (amountCurrency0 === 0n || amountCurrency1 === 0n) {
        return 79228162514264337593543950336n; // 2^96, SQRT_RATIO_1_1
    }
    const ratioX192 = (amountCurrency1 << 192n) / amountCurrency0;
    return bigIntSqrt(ratioX192);
}


