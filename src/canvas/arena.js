export class SharedArena {
    constructor(capacity) {

        this.m_data = new SharedArrayBuffer(capacity + 16); // +16 for metadata header

        // Int32Array view for atomic operations
        this.m_meta = new Int32Array(this.m_data, 0, 4);
        // [0] = current offset (atomic)
        // [1] = capacity
        // [2] = allocation count
        // [3] = lock flag (0=unlocked, 1=locked)

        Atomics.store(this.m_meta, 0, 16); // start after metadata
        Atomics.store(this.m_meta, 1, capacity);
        Atomics.store(this.m_meta, 2, 0);
        Atomics.store(this.m_meta, 3, 0);

        // Uint8Array for actual pixel data
        this.m_view = new Uint8Array(this.m_data, 16);
    }


    static fromBuffer(m_data) {
        const self = new SharedArena(0);
        self.m_data = m_data;
        self.m_meta = new Int32Array(self.m_data, 0, 4);
        self.m_view = new Uint8Array(self.m_data, 16);
        return self;
    }



    /**
  * thread-safe allocation using compare-and-swap
  * @param {number} size 
  * @param {number} alignment  
  * @param {boolean} autoGrow - if true, will attempt to grow arena on OOM
  */
    allocate(size, alignment = 4, autoGrow = false) {
        while (true) {
            /**
             *  offset += size isn't atomic. Two workers could read offset=1000, both add 500, both write 1500, now we got overlapping allocations. CAS ensures only one thread wins.
             */
            if (Atomics.compareExchange(this.m_meta, 3, 0, 1) !== 0) {
                continue; // someone else has lock
            }

            const offset = Atomics.load(this.m_meta, 0);
            const capacity = Atomics.load(this.m_meta, 1);
            const aligned = Math.ceil(offset / alignment) * alignment;

            if (aligned + size > capacity) {
                Atomics.store(this.m_meta, 3, 0); // release lock

                if (autoGrow) {
                    // calculate needed capacity with breathing room
                    const currentUsed = offset - 16;
                    const needed = currentUsed + size;
                    const breathingRoom = Math.max(size, 1024 * 1024); // At least 1MB or size of current allocation
                    this.grow(needed + breathingRoom);
                    continue; // retry allocation after growth
                }

                throw new Error(`Arena OOM: need ${size}, have ${capacity - aligned}`);
            }

            // Commit allocation
            Atomics.store(this.m_meta, 0, aligned + size);
            Atomics.add(this.m_meta, 2, 1);
            Atomics.store(this.m_meta, 3, 0); // release lock

            return aligned;
        }
    }

    /**
     * Grow the arena to a new capacity
     * @param {number} newCapacity - target capacity (will be rounded up if needed)
     */
    grow(newCapacity) {
        // Acquire lock
        while (Atomics.compareExchange(this.m_meta, 3, 0, 1) !== 0) {
            // spin until we get lock
        }

        try {
            const oldCapacity = Atomics.load(this.m_meta, 1);

            if (newCapacity <= oldCapacity) {
                return; // already big enough
            }

            // Create new buffer with increased capacity
            const newData = new SharedArrayBuffer(newCapacity + 16);
            const newMeta = new Int32Array(newData, 0, 4);
            const newView = new Uint8Array(newData, 16);

            // Copy old data
            newView.set(this.m_view.subarray(0, Atomics.load(this.m_meta, 0) - 16));

            // Copy metadata
            newMeta[0] = this.m_meta[0]; // offset
            newMeta[2] = this.m_meta[2]; // allocation count
            newMeta[3] = 0; // reset lock

            // Update capacity in new buffer
            Atomics.store(newMeta, 1, newCapacity);

            // Swap buffers
            this.m_data = newData;
            this.m_meta = newMeta;
            this.m_view = newView;

        } finally {
            // Release lock
            Atomics.store(this.m_meta, 3, 0);
        }
    }


    // /**
    //  * thread-safe allocation using compare-and-swap
    //  * @param {number} size 
    //  * @param {number} alignment  
    //  */
    // allocate(size, alignment = 4) {
    //     while (true) {
    //         /**
    //          *  offset += size isn't atomic. Two workers could read offset=1000, both add 500, both write 1500, now we got overlapping allocations. CAS ensures only one thread wins.
    //          */
    //         if (Atomics.compareExchange(this.m_meta, 3, 0, 1) !== 0) {
    //             continue; // someone else has lock
    //         }

    //         const offset = Atomics.load(this.m_meta, 0);
    //         const capacity = Atomics.load(this.m_meta, 1);
    //         const aligned = Math.ceil(offset / alignment) * alignment;

    //         if (aligned + size > capacity) {
    //             Atomics.store(this.m_meta, 3, 0); // release lock
    //             throw new Error(`Arena OOM: need ${size}, have ${capacity - aligned}`);
    //         }

    //         // Commit allocation
    //         Atomics.store(this.m_meta, 0, aligned + size);
    //         Atomics.add(this.m_meta, 2, 1);
    //         Atomics.store(this.m_meta, 3, 0); // release lock

    //         return aligned;
    //     }


    // }

    reset() {
        Atomics.store(this.m_meta, 0, 16);
        Atomics.store(this.m_meta, 2, 0);
        this.m_view.fill(0);
    }

    get stats() {
        const offset = Atomics.load(this.m_meta, 0);
        const capacity = Atomics.load(this.m_meta, 1);
        const count = Atomics.load(this.m_meta, 2);
        return {
            capacity,
            used: offset - 16,
            available: capacity - (offset - 16),
            allocationCount: count,
            utilization: ((offset - 16) / capacity * 100).toFixed(2) + '%'
        };
    }
}