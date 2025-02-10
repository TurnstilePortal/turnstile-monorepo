// The not-secret secret used to send messages to L2
pub global PUBLIC_NOT_SECRET_SECRET: Field = 0x7075626c6963;

// Sanity check to ensure the hardcoded value in L1 matches this value in L2
#[test]
unconstrained fn test_public_not_secret_secret() {
    let hash = aztec::hash::compute_secret_hash(PUBLIC_NOT_SECRET_SECRET);

    // This value is hardcoded in the L1 TokenPortal contract.
    // Hash of the string "public" used to send messages to L2. Computed with `computeSecretHash()` from aztec.js
    // computeSecretHash(Buffer.from("public").toString("hex")) = 0x08c95e8336028903a8b24af616b13aaf6ebea60cd17b4947e514e3600a797081
    let expected = 0x08c95e8336028903a8b24af616b13aaf6ebea60cd17b4947e514e3600a797081;

    if hash != expected {
        std::println(f"test_public_not_secret_secret: got: {hash}");
        std::println(f"test_public_not_secret_secret: expected: {expected}");
    }
    assert_eq(hash, expected);
}
