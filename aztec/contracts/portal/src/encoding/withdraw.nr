use aztec::protocol_types::{
    address::EthAddress,
    hash::sha256_to_field,
    traits::{FromField, ToField},
};

// bytes4(keccak256("withdraw(address,address,uint256)")) = 0xd9caed12
global WITHDRAW_SIGNATURE: [u8; 4] = [0xd9, 0xca, 0xed, 0x12];

pub fn withdraw_content_hash(eth_token: EthAddress, recipient: EthAddress, amount: Field) -> Field {
    let encoded = abi_encode_withdraw(eth_token, recipient, amount);
    let content_hash = sha256_to_field(encoded);
    content_hash
}

pub fn abi_encode_withdraw(
    eth_token: EthAddress,
    recipient: EthAddress,
    amount: Field,
) -> [u8; 100] {
    // abi.encodeWithSignature(WITHDRAW_SIGNATURE, tokenAddr, recipient, amount)
    // This encodes the following data:
    // offset - data
    // 0x00 - 4 bytes for the signature
    // 0x04 - 32 bytes for the token address
    // 0x24 - 32 bytes for the recipient
    // 0x44 - 32 bytes for the amount
    // Total: 100 bytes
    let mut encoded = [0; 100];
    for i in 0..4 {
        encoded[i] = WITHDRAW_SIGNATURE[i];
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

#[test]
fn test_abi_encode_withdraw() {
    let eth_token = EthAddress::from_field(0xbbEda607223492F9dce036A21C459fE1dcab56c7);
    let recipient = EthAddress::from_field(0x52b1D2CEBF3C80813f82dC4B5F56fCB4e04aC439);
    let amount = 0x1234567890abcdef;
    let encoded = abi_encode_withdraw(eth_token, recipient, amount);

    // abi.encodeWithSignature("withdraw(address,address,uint256)", address(0xbbEda607223492F9dce036A21C459fE1dcab56c7), address(0x52b1D2CEBF3C80813f82dC4B5F56fCB4e04aC439), 0x1234567890abcdef) =
    // 0xd9caed12000000000000000000000000bbeda607223492f9dce036a21c459fe1dcab56c700000000000000000000000052b1d2cebf3c80813f82dc4b5f56fcb4e04ac4390000000000000000000000000000000000000000000000001234567890abcdef
    let expected: [u8; 100] = [
        0xd9, 0xca, 0xed, 0x12, // Function selector - withdraw(address,address,uint256)
        // Eth Token Address
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // Padding
        // Address: 0xbbEda607223492F9dce036A21C459fE1dcab56c7
        0xbb, 0xed, 0xa6, 0x07, 0x22, 0x34, 0x92, 0xf9, 0xdc, 0xe0, 0x36, 0xa2, 0x1c, 0x45, 0x9f,
        0xe1, 0xdc, 0xab, 0x56, 0xc7,
        // Recipient Address
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // Padding
        // Address: 0x52b1D2CEBF3C80813f82dC4B5F56fCB4e04aC439
        0x52, 0xb1, 0xd2, 0xce, 0xbf, 0x3c, 0x80, 0x81, 0x3f, 0x82, 0xdc, 0x4b, 0x5f, 0x56, 0xfc,
        0xb4, 0xe0, 0x4a, 0xc4, 0x39,
        // Amount: 0x1234567890abcdef
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x12, 0x34, 0x56, 0x78, 0x90, 0xab,
        0xcd, 0xef,
    ];

    assert_eq(encoded, expected);
}
