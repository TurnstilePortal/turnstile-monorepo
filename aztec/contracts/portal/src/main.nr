mod constants;
mod encoding;
mod config;

use aztec::macros::aztec;

#[aztec]
pub contract Portal {
    use std::meta::derive;

    use aztec::{
        authwit::auth::assert_current_call_valid_authwit_public,
        event::event_interface::emit_event_in_public_log,
        hash::hash_args,
        macros::{
            events::event,
            functions::{
                initialization_utils::compute_initialization_hash, initializer, internal, private,
                public, utility, view,
            },
            storage::storage,
        },
        protocol_types::{
            address::{AztecAddress, EthAddress, PartialAddress},
            contract_class_id::ContractClassId,
            public_keys::PublicKeys,
            traits::{FromField, Serialize, ToField},
        },
        state_vars::{Map, PublicImmutable},
    };

    use token::Token;

    use crate::{
        config::Config,
        constants::PUBLIC_NOT_SECRET_SECRET,
        encoding::{
            deposit::deposit_content_hash, register::register_content_hash,
            withdraw::withdraw_content_hash,
        },
    };

    #[storage]
    struct Storage<Context> {
        config: PublicImmutable<Config, Context>,
        l1_tokens: Map<EthAddress, PublicImmutable<AztecAddress, Context>, Context>,
        l2_tokens: Map<AztecAddress, PublicImmutable<EthAddress, Context>, Context>,
    }

    #[derive(Serialize)]
    #[event]
    struct Register {
        eth_token: EthAddress,
        aztec_token: AztecAddress,
    }

    #[derive(Serialize)]
    #[event]
    struct Deposit {
        eth_token: EthAddress,
        recipient: AztecAddress,
        amount: u128,
        message_leaf_index: Field,
    }

    #[derive(Serialize)]
    #[event]
    struct Withdraw {
        token: EthAddress,
        from: AztecAddress,
        to: EthAddress,
        amount: u128,
    }

    #[public]
    #[initializer]
    fn constructor(
        l1_portal: EthAddress,
        token_contract_class_id: ContractClassId,
        shield_gateway: AztecAddress,
    ) {
        assert(!l1_portal.is_zero(), "L1 portal address cannot be zero");
        assert(token_contract_class_id.to_field() != 0, "Token contract class cannot be zero");
        assert(!shield_gateway.is_zero(), "Shield gateway address cannot be zero");

        storage.config.initialize(Config { l1_portal, shield_gateway, token_contract_class_id });
    }

    #[private]
    #[view]
    fn get_config_private() -> Config {
        storage.config.read()
    }

    #[public]
    #[view]
    fn get_config_public() -> Config {
        storage.config.read()
    }

    #[private]
    fn register_private(
        eth_token: EthAddress,
        aztec_token: AztecAddress,
        name: str<31>,
        name_len: u8,
        symbol: str<31>,
        symbol_len: u8,
        decimals: u8,
        message_leaf_index: Field,
    ) {
        aztec::oracle::debug_log::debug_log_format(
            "Registering L1 token {0} as L2 token {1}",
            [eth_token.to_field(), aztec_token.to_field()],
        );

        assert(storage.l1_tokens.at(eth_token).read().is_zero(), "Token already registered");

        let config = storage.config.read();

        // L1->L2 message content hash from token name, symbol, decimals
        let content_hash =
            register_content_hash(eth_token, name, name_len, symbol, symbol_len, decimals);
        aztec::oracle::debug_log::debug_log_format("Register content hash: {0}", [content_hash]);

        // Ensure the supplied token address matches the expected address. This ensures its deployed with
        // the correct code and initialization parameters.
        let initializer = Token::interface().constructor_with_minter(
            name,
            symbol,
            decimals,
            context.this_address() /* minter */,
            AztecAddress::zero(), /* not upgradable */
        );
        let args_hash = hash_args(initializer.args);
        aztec::oracle::debug_log::debug_log_format("Args hash: {0}", [args_hash]);
        let init_hash = compute_initialization_hash(initializer.selector, args_hash);
        aztec::oracle::debug_log::debug_log_format("Init hash: {0}", [init_hash]);
        let partial_address = PartialAddress::compute(
            config.token_contract_class_id,
            0x9876543210, // salt, hardcoded
            init_hash,
            AztecAddress::from_field(0),
        );

        aztec::oracle::debug_log::debug_log_format(
            "Computed partial address: {0}",
            [partial_address.to_field()],
        );
        let computed_address = AztecAddress::compute(PublicKeys::default(), partial_address);
        aztec::oracle::debug_log::debug_log_format(
            "Computed address: {0}",
            [computed_address.to_field()],
        );

        assert(
            computed_address == aztec_token,
            "Expected address did not match supplied token address",
        );

        // Set the shield gateway
        Token::at(aztec_token).set_shield_gateway(config.shield_gateway).enqueue(&mut context);

        // Consume the message
        aztec::oracle::debug_log::debug_log_format(
            "Consuming message with leaf index {0} from portal {1}",
            [message_leaf_index, config.l1_portal.to_field()],
        );

        aztec::oracle::debug_log::debug_log_format("L1 Portal: {0}", [config.l1_portal.to_field()]);

        context.consume_l1_to_l2_message(
            content_hash,
            PUBLIC_NOT_SECRET_SECRET,
            config.l1_portal,
            message_leaf_index,
        );

        Portal::at(context.this_address())._register_public(aztec_token, eth_token).enqueue(
            &mut context,
        );
    }

    #[public]
    #[internal]
    fn _register_public(aztec_token: AztecAddress, eth_token: EthAddress) {
        // Initialize the token mappings
        storage.l1_tokens.at(eth_token).initialize(aztec_token);
        storage.l2_tokens.at(aztec_token).initialize(eth_token);
        emit_event_in_public_log(Register { eth_token, aztec_token }, &mut context);
    }

    #[private]
    fn claim_public(
        eth_token: EthAddress,
        recipient: AztecAddress,
        amount: u128,
        message_leaf_index: Field,
    ) {
        let content_hash = deposit_content_hash(eth_token, recipient, amount.to_field());
        aztec::oracle::debug_log::debug_log_format("Deposit content hash: {0}", [content_hash]);

        let config = storage.config.read();

        // Consume the message
        context.consume_l1_to_l2_message(
            content_hash,
            PUBLIC_NOT_SECRET_SECRET,
            config.l1_portal,
            message_leaf_index,
        );

        Portal::at(context.this_address())
            ._claim_public(eth_token, recipient, amount, message_leaf_index)
            .enqueue(&mut context);
    }

    #[public]
    #[internal]
    fn _claim_public(
        eth_token: EthAddress,
        recipient: AztecAddress,
        amount: u128,
        message_leaf_index: Field,
    ) {
        Token::at(storage.l1_tokens.at(eth_token).read()).mint_to_public(recipient, amount).call(
            &mut context,
        );

        Portal::at(context.this_address())
            ._log_claim(eth_token, recipient, amount, message_leaf_index)
            .call(&mut context);
    }

    #[private]
    fn claim_shielded(
        eth_token: EthAddress,
        recipient: AztecAddress,
        amount: u128,
        message_leaf_index: Field,
    ) {
        let content_hash = deposit_content_hash(eth_token, recipient, amount.to_field());
        aztec::oracle::debug_log::debug_log_format("Deposit content hash: {0}", [content_hash]);

        let config = storage.config.read();

        // Consume the message
        context.consume_l1_to_l2_message(
            content_hash,
            PUBLIC_NOT_SECRET_SECRET,
            config.l1_portal,
            message_leaf_index,
        );

        Token::at(storage.l1_tokens.at(eth_token).read())
            .mint_to_private(recipient, recipient, amount)
            .call(&mut context);

        Portal::at(context.this_address())
            ._log_claim(eth_token, recipient, amount, message_leaf_index)
            .enqueue(&mut context);
    }

    #[public]
    #[internal]
    fn _log_claim(
        eth_token: EthAddress,
        recipient: AztecAddress,
        amount: u128,
        message_leaf_index: Field,
    ) {
        emit_event_in_public_log(
            Deposit { eth_token, recipient, amount, message_leaf_index },
            &mut context,
        );
    }

    #[public]
    fn withdraw_public(
        eth_token: EthAddress,
        from: AztecAddress,
        recipient: EthAddress,
        amount: u128,
        withdrawNonce: Field,
        burnNonce: Field,
    ) {
        if (!from.eq(context.msg_sender())) {
            assert_current_call_valid_authwit_public(&mut context, from);
        } else {
            assert(withdrawNonce == 0, "Invalid nonce");
        }

        let config = storage.config.read();

        // Burn the tokens
        Token::at(storage.l1_tokens.at(eth_token).read()).burn_public(from, amount, burnNonce).call(
            &mut context,
        );

        // Message the L1 Portal
        let content_hash = withdraw_content_hash(eth_token, recipient, amount.to_field());
        context.message_portal(config.l1_portal, content_hash);

        aztec::oracle::debug_log::debug_log_format("Withdraw L2ToL1 Message {0}", [content_hash]);

        emit_event_in_public_log(
            Withdraw { token: eth_token, from, to: recipient, amount },
            &mut context,
        );
    }

    #[utility]
    unconstrained fn is_registered_l1_unconstrained(eth_token: EthAddress) -> pub bool {
        !storage.l1_tokens.at(eth_token).read().is_zero()
    }

    #[utility]
    unconstrained fn is_registered_l2_unconstrained(aztec_token: AztecAddress) -> pub bool {
        !storage.l2_tokens.at(aztec_token).read().is_zero()
    }

    #[utility]
    unconstrained fn get_l2_token_unconstrained(eth_token: EthAddress) -> pub AztecAddress {
        storage.l1_tokens.at(eth_token).read()
    }

    #[utility]
    unconstrained fn get_l1_token_unconstrained(aztec_token: AztecAddress) -> pub EthAddress {
        storage.l2_tokens.at(aztec_token).read()
    }
}
