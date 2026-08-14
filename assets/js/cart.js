const CART_STORAGE_KEY = 'espacoDeliciaCart';
const CART_EXPIRATION_MS = 2 * 60 * 60 * 1000;

function assertNonEmptyString(value, fieldName) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new TypeError(`${fieldName} must be a non-empty string.`);
    }
}

function assertNonNegativeInteger(value, fieldName) {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new TypeError(`${fieldName} must be a non-negative integer.`);
    }
}

function assertPositiveInteger(value, fieldName) {
    if (!Number.isSafeInteger(value) || value < 1) {
        throw new TypeError(`${fieldName} must be a positive integer.`);
    }
}

function assertDenseArray(value, fieldName) {
    for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
            throw new TypeError(`${fieldName} must not contain empty slots.`);
        }
    }
}

function normalizeNotes(notes) {
    if (notes === undefined || notes === null) {
        return '';
    }

    if (typeof notes !== 'string') {
        throw new TypeError('notes must be a string, null, or undefined.');
    }

    return notes.trim();
}

function normalizeAddons(addons = []) {
    if (!Array.isArray(addons)) {
        throw new TypeError('addons must be an array.');
    }

    assertDenseArray(addons, 'addons');

    const selectedAddons = [];
    const selectedAddonIds = new Set();

    addons.forEach((addon, index) => {
        if (!addon || typeof addon !== 'object') {
            throw new TypeError(`addons[${index}] must be an object.`);
        }

        assertNonEmptyString(addon.addonId, `addons[${index}].addonId`);
        assertNonEmptyString(addon.name, `addons[${index}].name`);
        assertNonNegativeInteger(addon.unitPrice, `addons[${index}].unitPrice`);

        if (!Number.isSafeInteger(addon.quantity) || addon.quantity < 0) {
            throw new TypeError(
                `addons[${index}].quantity must be a non-negative integer.`,
            );
        }

        if (addon.quantity === 0) {
            return;
        }

        if (selectedAddonIds.has(addon.addonId)) {
            throw new TypeError(`Duplicate addonId: ${addon.addonId}.`);
        }

        selectedAddonIds.add(addon.addonId);
        selectedAddons.push({
            addonId: addon.addonId,
            name: addon.name,
            unitPrice: addon.unitPrice,
            quantity: addon.quantity,
        });
    });

    return selectedAddons.sort((first, second) => {
        if (first.addonId < second.addonId) {
            return -1;
        }

        if (first.addonId > second.addonId) {
            return 1;
        }

        return 0;
    });
}

function calculateUnitPrice(basePrice, addons) {
    const addonsTotal = addons.reduce((total, addon) => {
        const addonTotal = addon.unitPrice * addon.quantity;

        if (!Number.isSafeInteger(addonTotal) || !Number.isSafeInteger(total + addonTotal)) {
            throw new RangeError('The configured addon total exceeds the safe integer range.');
        }

        return total + addonTotal;
    }, 0);
    const unitPrice = basePrice + addonsTotal;

    if (!Number.isSafeInteger(unitPrice)) {
        throw new RangeError('unitPrice exceeds the safe integer range.');
    }

    return unitPrice;
}

function normalizeConfiguration(configuration) {
    if (!configuration || typeof configuration !== 'object') {
        throw new TypeError('configuration must be an object.');
    }

    assertNonEmptyString(configuration.productId, 'productId');
    assertNonEmptyString(configuration.productName, 'productName');
    assertNonNegativeInteger(configuration.basePrice, 'basePrice');
    assertPositiveInteger(configuration.quantity, 'quantity');

    const addons = normalizeAddons(configuration.addons);

    return {
        productId: configuration.productId,
        productName: configuration.productName,
        basePrice: configuration.basePrice,
        addons,
        notes: normalizeNotes(configuration.notes),
        quantity: configuration.quantity,
        unitPrice: calculateUnitPrice(configuration.basePrice, addons),
    };
}

function createLineId() {
    return crypto.randomUUID();
}

function createUniqueLineId(cart) {
    const existingIds = new Set(cart.map((item) => item.id));
    let id = createLineId();

    while (existingIds.has(id)) {
        id = createLineId();
    }

    return id;
}

function cloneCartItem(item) {
    return {
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        basePrice: item.basePrice,
        addons: item.addons.map((addon) => ({ ...addon })),
        notes: item.notes,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
    };
}

function validateAndCloneCart(cart) {
    if (!Array.isArray(cart)) {
        throw new TypeError('cart must be an array.');
    }

    assertDenseArray(cart, 'cart');

    const lineIds = new Set();

    return cart.map((item, index) => {
        if (!item || typeof item !== 'object') {
            throw new TypeError(`cart[${index}] must be an object.`);
        }

        assertNonEmptyString(item.id, `cart[${index}].id`);

        if (lineIds.has(item.id)) {
            throw new TypeError(`Duplicate cart line id: ${item.id}.`);
        }

        lineIds.add(item.id);

        const normalized = normalizeConfiguration(item);

        if (item.notes !== normalized.notes) {
            throw new TypeError(`cart[${index}].notes is not normalized.`);
        }

        if (item.unitPrice !== normalized.unitPrice) {
            throw new TypeError(`cart[${index}].unitPrice is inconsistent.`);
        }

        if (
            item.addons.length !== normalized.addons.length ||
            item.addons.some(
                (addon, addonIndex) =>
                    addon.addonId !== normalized.addons[addonIndex].addonId ||
                    addon.name !== normalized.addons[addonIndex].name ||
                    addon.unitPrice !== normalized.addons[addonIndex].unitPrice ||
                    addon.quantity !== normalized.addons[addonIndex].quantity,
            )
        ) {
            throw new TypeError(`cart[${index}].addons is not normalized.`);
        }

        return cloneCartItem({ id: item.id, ...normalized });
    });
}

function hasOwnProperty(object, property) {
    return Object.prototype.hasOwnProperty.call(object, property);
}

function restorePersistedCart(cart) {
    if (!Array.isArray(cart)) {
        throw new TypeError('Persisted cart must be an array.');
    }

    assertDenseArray(cart, 'Persisted cart');

    const requiredFields = [
        'id',
        'productId',
        'productName',
        'basePrice',
        'addons',
        'notes',
        'quantity',
        'unitPrice',
    ];
    const lineIds = new Set();
    const restoredCart = cart.map((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            throw new TypeError(`Persisted cart[${index}] must be an object.`);
        }

        if (requiredFields.some((field) => !hasOwnProperty(item, field))) {
            throw new TypeError(`Persisted cart[${index}] is missing a required field.`);
        }

        assertNonEmptyString(item.id, `Persisted cart[${index}].id`);

        if (lineIds.has(item.id)) {
            throw new TypeError(`Duplicate persisted cart line id: ${item.id}.`);
        }

        lineIds.add(item.id);

        if (typeof item.notes !== 'string') {
            throw new TypeError(`Persisted cart[${index}].notes must be a string.`);
        }

        if (!Array.isArray(item.addons)) {
            throw new TypeError(`Persisted cart[${index}].addons must be an array.`);
        }

        assertDenseArray(item.addons, `Persisted cart[${index}].addons`);

        item.addons.forEach((addon, addonIndex) => {
            if (!addon || typeof addon !== 'object' || Array.isArray(addon)) {
                throw new TypeError(
                    `Persisted cart[${index}].addons[${addonIndex}] must be an object.`,
                );
            }

            const addonFields = ['addonId', 'name', 'unitPrice', 'quantity'];

            if (addonFields.some((field) => !hasOwnProperty(addon, field))) {
                throw new TypeError(
                    `Persisted cart[${index}].addons[${addonIndex}] is missing a required field.`,
                );
            }

            assertPositiveInteger(
                addon.quantity,
                `Persisted cart[${index}].addons[${addonIndex}].quantity`,
            );
        });

        const normalized = normalizeConfiguration(item);

        return {
            id: item.id,
            ...normalized,
        };
    });

    assertNoEquivalentLines(restoredCart, 'Persisted cart');

    getCartTotal(restoredCart);
    getCartTotalUnits(restoredCart);

    return restoredCart;
}

function removePersistedCart() {
    try {
        globalThis.localStorage.removeItem(CART_STORAGE_KEY);
        return true;
    } catch {
        return false;
    }
}

function haveEquivalentConfigurations(first, second) {
    return (
        first.productId === second.productId &&
        first.notes === second.notes &&
        first.addons.length === second.addons.length &&
        first.addons.every(
            (addon, index) =>
                addon.addonId === second.addons[index].addonId &&
                addon.quantity === second.addons[index].quantity,
        )
    );
}

function assertNoEquivalentLines(cart, sourceName) {
    cart.forEach((item, index) => {
        for (let otherIndex = index + 1; otherIndex < cart.length; otherIndex += 1) {
            if (haveEquivalentConfigurations(item, cart[otherIndex])) {
                throw new TypeError(`${sourceName} contains equivalent duplicate lines.`);
            }
        }
    });
}

function addOneUnit(item) {
    if (!Number.isSafeInteger(item.quantity + 1)) {
        throw new RangeError('The line quantity exceeds the safe integer range.');
    }

    item.quantity += 1;
}

export function createCartItem(configuration) {
    const normalized = normalizeConfiguration(configuration);

    return {
        id: createLineId(),
        ...normalized,
    };
}

export function areCartItemsEquivalent(first, second) {
    return haveEquivalentConfigurations(
        normalizeConfiguration(first),
        normalizeConfiguration(second),
    );
}

export function addCartItem(cart, configuration) {
    const nextCart = validateAndCloneCart(cart);
    const normalized = normalizeConfiguration(configuration);
    const equivalentItem = nextCart.find((item) =>
        haveEquivalentConfigurations(item, normalized),
    );

    if (equivalentItem) {
        const combinedQuantity = equivalentItem.quantity + normalized.quantity;

        if (!Number.isSafeInteger(combinedQuantity)) {
            throw new RangeError('The combined quantity exceeds the safe integer range.');
        }

        equivalentItem.quantity = combinedQuantity;
        return nextCart;
    }

    nextCart.push({
        id: createUniqueLineId(nextCart),
        ...normalized,
    });

    return nextCart;
}

export function incrementCartItem(cart, lineId) {
    const nextCart = validateAndCloneCart(cart);
    const item = nextCart.find((line) => line.id === lineId);

    if (!item) {
        return nextCart;
    }

    addOneUnit(item);
    return nextCart;
}

export function decrementCartItem(cart, lineId) {
    const nextCart = validateAndCloneCart(cart);
    const item = nextCart.find((line) => line.id === lineId);

    if (!item || item.quantity === 1) {
        return nextCart;
    }

    item.quantity -= 1;
    return nextCart;
}

export function removeCartItem(cart, lineId) {
    const nextCart = validateAndCloneCart(cart);
    return nextCart.filter((item) => item.id !== lineId);
}

export function editCartItem(cart, lineId, configuration) {
    const nextCart = validateAndCloneCart(cart);
    const sourceIndex = nextCart.findIndex((item) => item.id === lineId);

    if (sourceIndex === -1) {
        return nextCart;
    }

    const editedConfiguration = normalizeConfiguration(configuration);

    if (editedConfiguration.quantity !== 1) {
        throw new TypeError('An edit must describe exactly one unit.');
    }

    const sourceItem = nextCart[sourceIndex];

    if (haveEquivalentConfigurations(sourceItem, editedConfiguration)) {
        return nextCart;
    }

    const equivalentIndex = nextCart.findIndex(
        (item, index) =>
            index !== sourceIndex &&
            haveEquivalentConfigurations(item, editedConfiguration),
    );

    if (sourceItem.quantity > 1) {
        sourceItem.quantity -= 1;

        if (equivalentIndex !== -1) {
            addOneUnit(nextCart[equivalentIndex]);
        } else {
            nextCart.push({
                id: createUniqueLineId(nextCart),
                ...editedConfiguration,
            });
        }

        return nextCart;
    }

    if (equivalentIndex !== -1) {
        addOneUnit(nextCart[equivalentIndex]);
        nextCart.splice(sourceIndex, 1);
        return nextCart;
    }

    nextCart[sourceIndex] = {
        id: sourceItem.id,
        ...editedConfiguration,
    };

    return nextCart;
}

export function getCartTotal(cart) {
    return validateAndCloneCart(cart).reduce((total, item) => {
        const lineTotal = item.unitPrice * item.quantity;

        if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(total + lineTotal)) {
            throw new RangeError('The cart total exceeds the safe integer range.');
        }

        return total + lineTotal;
    }, 0);
}

export function getCartTotalUnits(cart) {
    return validateAndCloneCart(cart).reduce((total, item) => {
        if (!Number.isSafeInteger(total + item.quantity)) {
            throw new RangeError('The total unit count exceeds the safe integer range.');
        }

        return total + item.quantity;
    }, 0);
}

export function saveCart(cart) {
    const validatedCart = validateAndCloneCart(cart);
    assertNoEquivalentLines(validatedCart, 'Cart');
    getCartTotal(validatedCart);
    getCartTotalUnits(validatedCart);

    if (validatedCart.length === 0) {
        return removePersistedCart();
    }

    const persistedState = JSON.stringify({
        cart: validatedCart,
        lastUpdated: Date.now(),
    });

    try {
        globalThis.localStorage.setItem(CART_STORAGE_KEY, persistedState);
        return true;
    } catch {
        return false;
    }
}

export function loadCart() {
    let serializedState;

    try {
        serializedState = globalThis.localStorage.getItem(CART_STORAGE_KEY);
    } catch {
        return [];
    }

    if (serializedState === null) {
        return [];
    }

    let persistedState;

    try {
        persistedState = JSON.parse(serializedState);
    } catch {
        removePersistedCart();
        return [];
    }

    try {
        if (
            !persistedState ||
            typeof persistedState !== 'object' ||
            Array.isArray(persistedState) ||
            !hasOwnProperty(persistedState, 'cart') ||
            !hasOwnProperty(persistedState, 'lastUpdated')
        ) {
            throw new TypeError('Persisted cart state has an invalid structure.');
        }

        const now = Date.now();

        if (
            !Number.isSafeInteger(persistedState.lastUpdated) ||
            persistedState.lastUpdated < 0 ||
            persistedState.lastUpdated > now
        ) {
            throw new TypeError('Persisted cart timestamp is invalid.');
        }

        if (now - persistedState.lastUpdated >= CART_EXPIRATION_MS) {
            removePersistedCart();
            return [];
        }

        return restorePersistedCart(persistedState.cart);
    } catch (error) {
        if (!(error instanceof TypeError) && !(error instanceof RangeError)) {
            throw error;
        }

        removePersistedCart();
        return [];
    }
}

export function clearCartStorage() {
    return removePersistedCart();
}
