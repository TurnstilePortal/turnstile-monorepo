use aztec::macros::aztec;

#[aztec]
pub contract DevAdvanceBlock {
    use aztec::macros::functions::public;
    use aztec::macros::storage::storage;
    use aztec::prelude::PublicMutable;

    #[storage]
    struct Storage<Context> {
        count: PublicMutable<u64, Context>,
    }

    #[public]
    fn increment() {
        storage.count.write(storage.count.read() + 1);
    }
}
