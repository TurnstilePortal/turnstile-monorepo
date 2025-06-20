use aztec::protocol_types::{
    address::{AztecAddress, EthAddress},
    contract_class_id::ContractClassId,
    traits::{Deserialize, Packable, Serialize},
};
use std::meta::derive;

// PublicImmutable has constant read cost in private regardless of the size of what it stores, so we put
// the basic portal configuration in a single struct to avoid having to read multiple times
#[derive(Deserialize, Eq, Packable, Serialize)]
pub struct Config {
    pub l1_portal: EthAddress,
    pub shield_gateway: AztecAddress,
    pub token_contract_class_id: ContractClassId,
}
