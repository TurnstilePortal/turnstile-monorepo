mod test;

use aztec::macros::aztec;

#[aztec]
pub contract ShieldGateway {
    use std::meta::derive;

    use aztec::{
        event::event_interface::{emit_event_in_public_log, EventInterface},
        macros::{events::event, functions::{initializer, internal, private, public, view}},
        oracle::capsules,
        protocol_types::{address::AztecAddress, traits::{FromField, Hash, Serialize, ToField}},
    };

    pub global VP_SLOT: Field = 0x1dfeed;
    pub global BIN_AMOUNT: u128 = 1_000_000_000;

    #[derive(Serialize)]
    #[event]
    struct TransferEvent {
        serial: Field,
        token: AztecAddress,
        binnedAmount: u128,
    }

    #[private]
    fn check_transfer(sender: AztecAddress, recipient: AztecAddress, amount: u128) {
        let token: AztecAddress = context.msg_sender();

        aztec::oracle::debug_log::debug_log_format(
            "Checking transfer of {0} {1} tokens from {2} to {3}",
            [amount.to_field(), token.to_field(), sender.to_field(), recipient.to_field()],
        );

        // TODO: Implement verified ID checks
        // // Ensure Verified ID is provided & valid
        // // Safety: value constrained later
        // let mut verified_id: [Field; 5] =
        //     unsafe { capsules::load(context.this_address(), VP_SLOT).unwrap() };

        // let _ = ShieldGateway::at(context.this_address()).verify_id_private(verified_id).view(
        //     &mut context,
        // );

        // Publicly log Verified ID Serial & Token & binned value (Amount / BIN_AMOUNT)
        ShieldGateway::at(context.this_address())
            ._log_transfer(
                0, // TODO: using dummy serial number. Switch to verified_id[0] when available
                token,
                _binned(amount),
            )
            .enqueue(&mut context);
    }

    #[contract_library_method]
    fn _binned(amount: u128) -> u128 {
        amount / BIN_AMOUNT
    }

    #[public]
    #[internal]
    fn _log_transfer(serial: Field, token: AztecAddress, binnedAmount: u128) {
        emit_event_in_public_log(TransferEvent { serial, token, binnedAmount }, &mut context);
    }

    #[private]
    #[view]
    fn verify_id_private(verified_id: [Field; 5]) -> bool {
        // TODO: Implement ID verification logic
        aztec::oracle::debug_log::debug_log_format("Verified ID: {}", verified_id);
        true
    }
}
