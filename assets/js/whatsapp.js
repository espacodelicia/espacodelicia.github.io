const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
});

const PAYMENT_LABELS = {
    pix: 'Pix',
    card: 'Cartão',
    cash: 'Dinheiro',
};

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertPlainObject(value, fieldName) {
    if (!isPlainObject(value)) {
        throw new TypeError(`${fieldName} must be an object.`);
    }
}

function assertNonEmptyString(value, fieldName) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new TypeError(`${fieldName} must be a non-empty string.`);
    }
}

function assertNormalizedString(value, fieldName, { allowEmpty = false } = {}) {
    if (typeof value !== 'string' || value !== value.trim() || (!allowEmpty && value === '')) {
        throw new TypeError(`${fieldName} must be a normalized string.`);
    }
}

function assertSingleLineString(
    value,
    fieldName,
    { allowEmpty = false, normalized = false } = {},
) {
    if (normalized) {
        assertNormalizedString(value, fieldName, { allowEmpty });
    } else if (allowEmpty) {
        if (typeof value !== 'string') {
            throw new TypeError(`${fieldName} must be a string.`);
        }
    } else {
        assertNonEmptyString(value, fieldName);
    }

    if (/[\u0000-\u001f\u007f]/.test(value)) {
        throw new TypeError(`${fieldName} must not contain control characters.`);
    }
}

function assertDenseArray(value, fieldName) {
    for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) {
            throw new TypeError(`${fieldName} must not contain empty slots.`);
        }
    }
}

function assertNonNegativeMoney(value, fieldName) {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new TypeError(`${fieldName} must be a non-negative safe integer.`);
    }
}

function assertPositiveInteger(value, fieldName) {
    if (!Number.isSafeInteger(value) || value < 1) {
        throw new TypeError(`${fieldName} must be a positive safe integer.`);
    }
}

function addMoney(first, second, fieldName) {
    const result = first + second;

    if (!Number.isSafeInteger(result)) {
        throw new RangeError(`${fieldName} exceeds the safe integer range.`);
    }

    return result;
}

function multiplyMoney(value, quantity, fieldName) {
    const result = value * quantity;

    if (!Number.isSafeInteger(result)) {
        throw new RangeError(`${fieldName} exceeds the safe integer range.`);
    }

    return result;
}

function formatCurrency(cents) {
    return currencyFormatter.format(cents / 100).replace(/\u00a0/g, ' ');
}

function formatPhone(phone) {
    return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`;
}

function validateAddon(addon, lineIndex, addonIndex, previousAddonId, addonIds) {
    const fieldName = `cart[${lineIndex}].addons[${addonIndex}]`;
    assertPlainObject(addon, fieldName);
    assertSingleLineString(addon.addonId, `${fieldName}.addonId`);
    assertSingleLineString(addon.name, `${fieldName}.name`);
    assertNonNegativeMoney(addon.unitPrice, `${fieldName}.unitPrice`);
    assertPositiveInteger(addon.quantity, `${fieldName}.quantity`);

    if (addonIds.has(addon.addonId)) {
        throw new TypeError(`${fieldName}.addonId is duplicated.`);
    }

    if (previousAddonId !== null && addon.addonId < previousAddonId) {
        throw new TypeError(`${fieldName} is not in canonical order.`);
    }

    addonIds.add(addon.addonId);
}

function validateCart(cart) {
    if (!Array.isArray(cart)) {
        throw new TypeError('cart must be an array.');
    }

    if (cart.length === 0) {
        throw new TypeError('cart must contain at least one line.');
    }

    assertDenseArray(cart, 'cart');

    const lineIds = new Set();
    let productsTotal = 0;

    cart.forEach((line, lineIndex) => {
        const fieldName = `cart[${lineIndex}]`;
        assertPlainObject(line, fieldName);
        assertSingleLineString(line.id, `${fieldName}.id`);
        assertSingleLineString(line.productId, `${fieldName}.productId`);
        assertSingleLineString(line.productName, `${fieldName}.productName`);
        assertNonNegativeMoney(line.basePrice, `${fieldName}.basePrice`);
        assertNonNegativeMoney(line.unitPrice, `${fieldName}.unitPrice`);
        assertPositiveInteger(line.quantity, `${fieldName}.quantity`);
        assertNormalizedString(line.notes, `${fieldName}.notes`, { allowEmpty: true });

        if (lineIds.has(line.id)) {
            throw new TypeError(`${fieldName}.id is duplicated.`);
        }

        lineIds.add(line.id);

        if (!Array.isArray(line.addons)) {
            throw new TypeError(`${fieldName}.addons must be an array.`);
        }

        assertDenseArray(line.addons, `${fieldName}.addons`);

        const addonIds = new Set();
        let addonsTotal = 0;
        let previousAddonId = null;

        line.addons.forEach((addon, addonIndex) => {
            validateAddon(addon, lineIndex, addonIndex, previousAddonId, addonIds);
            const addonTotal = multiplyMoney(
                addon.unitPrice,
                addon.quantity,
                `${fieldName}.addons total`,
            );
            addonsTotal = addMoney(addonsTotal, addonTotal, `${fieldName}.addons total`);
            previousAddonId = addon.addonId;
        });

        const expectedUnitPrice = addMoney(
            line.basePrice,
            addonsTotal,
            `${fieldName}.unitPrice`,
        );

        if (line.unitPrice !== expectedUnitPrice) {
            throw new RangeError(`${fieldName}.unitPrice is inconsistent.`);
        }

        const lineTotal = multiplyMoney(
            line.unitPrice,
            line.quantity,
            `${fieldName} subtotal`,
        );
        productsTotal = addMoney(productsTotal, lineTotal, 'cart products total');
    });

    return productsTotal;
}

function validateDelivery(checkoutData) {
    if (checkoutData.fulfillmentType === 'pickup') {
        if (checkoutData.delivery !== null || checkoutData.deliveryFee !== 0) {
            throw new TypeError('pickup must not contain delivery data or a delivery fee.');
        }

        return;
    }

    if (checkoutData.fulfillmentType !== 'delivery') {
        throw new TypeError('checkoutData.fulfillmentType is invalid.');
    }

    assertPlainObject(checkoutData.delivery, 'checkoutData.delivery');
    assertSingleLineString(checkoutData.delivery.street, 'checkoutData.delivery.street', {
        normalized: true,
    });
    assertSingleLineString(checkoutData.delivery.number, 'checkoutData.delivery.number', {
        normalized: true,
    });
    assertSingleLineString(
        checkoutData.delivery.neighborhood,
        'checkoutData.delivery.neighborhood',
        { normalized: true },
    );
    assertSingleLineString(
        checkoutData.delivery.complement,
        'checkoutData.delivery.complement',
        { allowEmpty: true, normalized: true },
    );
}

function validatePayment(payment, total) {
    assertPlainObject(payment, 'checkoutData.payment');

    if (!Object.hasOwn(PAYMENT_LABELS, payment.method)) {
        throw new TypeError('checkoutData.payment.method is invalid.');
    }

    if (payment.method !== 'cash') {
        if (
            payment.needsChange !== false ||
            payment.changeFor !== null ||
            payment.changeAmount !== 0
        ) {
            throw new TypeError('non-cash payment must not contain change data.');
        }

        return;
    }

    if (typeof payment.needsChange !== 'boolean') {
        throw new TypeError('checkoutData.payment.needsChange must be a boolean.');
    }

    if (!payment.needsChange) {
        if (payment.changeFor !== null || payment.changeAmount !== 0) {
            throw new TypeError('cash without change must not contain change values.');
        }

        return;
    }

    assertNonNegativeMoney(payment.changeFor, 'checkoutData.payment.changeFor');
    assertNonNegativeMoney(payment.changeAmount, 'checkoutData.payment.changeAmount');

    if (payment.changeFor <= total) {
        throw new RangeError('checkoutData.payment.changeFor must be greater than total.');
    }

    if (payment.changeAmount !== payment.changeFor - total) {
        throw new RangeError('checkoutData.payment.changeAmount is inconsistent.');
    }
}

function validateCheckoutData(checkoutData, cartProductsTotal, business) {
    assertPlainObject(checkoutData, 'checkoutData');
    assertPlainObject(checkoutData.customer, 'checkoutData.customer');
    assertSingleLineString(checkoutData.customer.fullName, 'checkoutData.customer.fullName', {
        normalized: true,
    });

    if (
        typeof checkoutData.customer.phone !== 'string' ||
        !/^\d{11}$/.test(checkoutData.customer.phone)
    ) {
        throw new TypeError('checkoutData.customer.phone must contain exactly 11 digits.');
    }

    assertNonNegativeMoney(checkoutData.productsTotal, 'checkoutData.productsTotal');
    assertNonNegativeMoney(checkoutData.deliveryFee, 'checkoutData.deliveryFee');
    assertNonNegativeMoney(checkoutData.total, 'checkoutData.total');
    validateDelivery(checkoutData);

    if (checkoutData.productsTotal !== cartProductsTotal) {
        throw new RangeError('checkoutData.productsTotal is inconsistent with cart.');
    }

    if (
        checkoutData.fulfillmentType === 'delivery' &&
        checkoutData.deliveryFee !== business.deliveryFee
    ) {
        throw new RangeError('checkoutData.deliveryFee is inconsistent with business.');
    }

    const expectedTotal = addMoney(
        checkoutData.productsTotal,
        checkoutData.deliveryFee,
        'checkoutData.total',
    );

    if (checkoutData.total !== expectedTotal) {
        throw new RangeError('checkoutData.total is inconsistent.');
    }

    validatePayment(checkoutData.payment, checkoutData.total);
}

function validateBusiness(business) {
    assertPlainObject(business, 'business');
    assertSingleLineString(business.name, 'business.name');
    assertNonNegativeMoney(business.deliveryFee, 'business.deliveryFee');
}

function formatOrderItem(line) {
    const lines = [
        `${line.quantity}x ${line.productName}`,
        `Unitário: ${formatCurrency(line.unitPrice)}`,
        `Subtotal: ${formatCurrency(line.unitPrice * line.quantity)}`,
    ];

    if (line.addons.length > 0) {
        lines.push('Adicionais:');
        line.addons.forEach((addon) => lines.push(`+ ${addon.name} x${addon.quantity}`));
    }

    if (line.notes) {
        lines.push(`Obs.: ${line.notes}`);
    }

    return lines;
}

function formatPayment(payment) {
    const lines = [`Pagamento: ${PAYMENT_LABELS[payment.method]}`];

    if (payment.method !== 'cash') {
        return lines;
    }

    if (!payment.needsChange) {
        lines.push('Troco: Não precisa');
        return lines;
    }

    lines.push(`Troco para: ${formatCurrency(payment.changeFor)}`);
    lines.push(`Troco: ${formatCurrency(payment.changeAmount)}`);
    return lines;
}

export function buildWhatsAppMessage(cart, checkoutData, business) {
    validateBusiness(business);
    const cartProductsTotal = validateCart(cart);
    validateCheckoutData(checkoutData, cartProductsTotal, business);

    const lines = [
        `*PEDIDO - ${business.name.toLocaleUpperCase('pt-BR')}*`,
        '',
        `Cliente: ${checkoutData.customer.fullName}`,
        `Telefone: ${formatPhone(checkoutData.customer.phone)}`,
        `Forma: ${checkoutData.fulfillmentType === 'delivery' ? 'Delivery' : 'Retirada'}`,
    ];

    if (checkoutData.delivery) {
        lines.push(
            '',
            `Endereço: ${checkoutData.delivery.street}, ${checkoutData.delivery.number}`,
            `Bairro: ${checkoutData.delivery.neighborhood}`,
        );

        if (checkoutData.delivery.complement) {
            lines.push(`Complemento: ${checkoutData.delivery.complement}`);
        }
    }

    lines.push('');
    cart.forEach((line) => lines.push('--------------------', ...formatOrderItem(line)));
    lines.push(
        '--------------------',
        '',
        `Subtotal dos produtos: ${formatCurrency(checkoutData.productsTotal)}`,
    );

    if (checkoutData.fulfillmentType === 'delivery') {
        lines.push(
            `Taxa de entrega: ${
                checkoutData.deliveryFee === 0
                    ? 'Grátis'
                    : formatCurrency(checkoutData.deliveryFee)
            }`,
        );
    }

    lines.push(
        `*Total: ${formatCurrency(checkoutData.total)}*`,
        '',
        ...formatPayment(checkoutData.payment),
    );
    return lines.join('\n');
}
