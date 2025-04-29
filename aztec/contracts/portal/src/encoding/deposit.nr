use aztec::{
    protocol_types::{
        address::{AztecAddress, EthAddress},
        hash::sha256_to_field,
        traits::{FromField, ToField},
    },
};

// bytes4(keccak256("deposit(address,bytes32,uint256)")) = 0xeb2243f8
global DEPOSIT_SIGNATURE: [u8; 4] = [0xeb, 0x22, 0x43, 0xf8];

pub fn deposit_content_hash(
    eth_token: EthAddress,
    recipient: AztecAddress,
    amount: Field,
) -> Field {
    let encoded = abi_encode_deposit(eth_token, recipient, amount);
    let content_hash = sha256_to_field(encoded);
    content_hash
}

pub fn abi_encode_deposit(
    eth_token: EthAddress,
    recipient: AztecAddress,
    amount: Field,
) -> [u8; 100] {
    // abi.encodeWithSignature(DEPOSIT_SIGNATURE, tokenAddr, recipient, amount)
    // This encodes the following data:
    // offset - data
    // 0x00 - 4 bytes for the signature
    // 0x04 - 32 bytes for the token address
    // 0x24 - 32 bytes for the recipient
    // 0x44 - 32 bytes for the amount
    // Total: 100 bytes
    let mut encoded = [0; 100];
    for i in 0..4 {
        encoded[i] = DEPOSIT_SIGNATURE[i];
    }

    let eth_token_bytes: [u8; 32] = eth_token.to_field().to_be_bytes();
    let recipient_bytes: [u8; 32] = recipient.to_field().to_be_bytes();
    let amount_bytes: [u8; 32] = amount.to_be_bytes();

    for i in 0..32 {
        encoded[i + 0x4] = eth_token_bytes[i];
        encoded[i + 0x24] = recipient_bytes[i];
        encoded[i + 0x44] = amount_bytes[i];
    }

    encoded
}

// For testing purposes, enables printing the ABI-encoded data
pub unconstrained fn field_from_encoded_bytes(encoded: [u8; 100], offset: u32) -> Field {
    let mut arr = [0; 31];
    for i in 0..31 {
        if offset + i >= 100 {
            break;
        }
        arr[i] = encoded[offset + i];
    }
    aztec::protocol_types::utils::field::field_from_bytes(arr, true)
}

#[test]
fn test_abi_encode_deposit() {
    let eth_token = EthAddress::from_field(0x2458675Deb5E0691da2D2bA8dCaF58CFD2C2651F);
    let recipient = AztecAddress::from_field(
        0x1e571fd19f8f3aab48fd795e1b39f72dd61f44735c88a7576721be8a5065f863,
    );
    let amount = 0x1234567890abcdef1234567890abcdef;
    let encoded = abi_encode_deposit(eth_token, recipient, amount);

    // abi.encodeWithSignature("deposit(address,bytes32,uint256)", address(0x2458675Deb5E0691da2D2bA8dCaF58CFD2C2651F), bytes32(hex"1e571fd19f8f3aab48fd795e1b39f72dd61f44735c88a7576721be8a5065f863"), 0x1234567890abcdef1234567890abcdef) =
    // 0xeb2243f80000000000000000000000002458675deb5e0691da2d2ba8dcaf58cfd2c2651f1e571fd19f8f3aab48fd795e1b39f72dd61f44735c88a7576721be8a5065f863000000000000000000000000000000001234567890abcdef1234567890abcdef
    let expected: [u8; 100] = [
        0xeb, 0x22, 0x43, 0xf8, // Function selector - deposit(address,bytes32,uint256)
        // Eth Token Address
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // Padding
        // Address: 0x2458675Deb5E0691da2D2bA8dCaF58CFD2C2651F
        0x24, 0x58, 0x67, 0x5d, 0xeb, 0x5e, 0x06, 0x91, 0xda, 0x2d, 0x2b, 0xa8, 0xdc, 0xaf, 0x58,
        0xcf, 0xd2, 0xc2, 0x65, 0x1f,
        // Aztec Recipient Address
        0x1e, 0x57, 0x1f, 0xd1, 0x9f, 0x8f, 0x3a, 0xab, 0x48, 0xfd, 0x79, 0x5e, 0x1b, 0x39, 0xf7,
        0x2d, 0xd6, 0x1f, 0x44, 0x73, 0x5c, 0x88, 0xa7, 0x57, 0x67, 0x21, 0xbe, 0x8a, 0x50, 0x65,
        0xf8, 0x63,
        // Amount
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x12, 0x34, 0x56, 0x78, 0x90, 0xab, 0xcd, 0xef, 0x12, 0x34, 0x56, 0x78, 0x90, 0xab,
        0xcd, 0xef,
    ];

    if encoded != expected {
        std::println(f"test_abi_encode_deposit: got: {encoded}");
        std::println(f"test_abi_encode_deposit: expected: {expected}");
    }
    assert_eq(encoded, expected);
}

#[test]
fn test_deposit_content_hash() {
    let content: [u8; 100] = [
        0xeb, 0x22, 0x43, 0xf8, // Function selector - deposit(address,bytes32,uint256)
        // Eth Token Address
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // Padding
        // Address: 0x2458675Deb5E0691da2D2bA8dCaF58CFD2C2651F
        0x24, 0x58, 0x67, 0x5d, 0xeb, 0x5e, 0x06, 0x91, 0xda, 0x2d, 0x2b, 0xa8, 0xdc, 0xaf, 0x58,
        0xcf, 0xd2, 0xc2, 0x65, 0x1f,
        // Aztec Recipient Address
        0x1e, 0x57, 0x1f, 0xd1, 0x9f, 0x8f, 0x3a, 0xab, 0x48, 0xfd, 0x79, 0x5e, 0x1b, 0x39, 0xf7,
        0x2d, 0xd6, 0x1f, 0x44, 0x73, 0x5c, 0x88, 0xa7, 0x57, 0x67, 0x21, 0xbe, 0x8a, 0x50, 0x65,
        0xf8, 0x63,
        // Amount
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x12, 0x34, 0x56, 0x78, 0x90, 0xab, 0xcd, 0xef, 0x12, 0x34, 0x56, 0x78, 0x90, 0xab,
        0xcd, 0xef,
    ];

    // sha256(content) = 0x5a05320993a46599dc6c5605c5f2bf139d6fb5f3709e23c5af2b530f1e883aa8
    // sha256_to_field uses the first 31 bytes of the hash
    let expected: Field = 0x5a05320993a46599dc6c5605c5f2bf139d6fb5f3709e23c5af2b530f1e883a;
    let content_hash = sha256_to_field(content);
    if content_hash != expected {
        std::println(f"test_deposit_content_hash: got: {content_hash}");
        std::println(f"test_deposit_content_hash: expected: {expected}");
    }
    assert_eq(content_hash, expected);
}
