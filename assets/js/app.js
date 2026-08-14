import { business } from './business.js';
import {
    addCartItem,
    clearCartStorage,
    decrementCartItem,
    editCartItem,
    getCartTotal,
    getCartTotalUnits,
    incrementCartItem,
    loadCart,
    removeCartItem,
    saveCart,
} from './cart.js';
import {
    buildCheckoutDetails,
    formatPhone,
    getCheckoutTotals,
    validateCheckoutDetails,
} from './checkout.js';
import { menu } from './menu.js';
import { buildWhatsAppMessage, buildWhatsAppUrl } from './whatsapp.js';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
});
const WHATSAPP_REENTRY_DELAY_MS = 500;

const categoryList = document.querySelector('#category-list');
const menuContent = document.querySelector('#menu-content');
const businessName = document.querySelector('#business-name');
const businessDialog = document.querySelector('#business-info');
const businessInfoTitle = document.querySelector('#business-info-title');
const businessInfoContent = document.querySelector('#business-info-content');
const openBusinessInfoButton = document.querySelector('#open-business-info');
const closeBusinessInfoButton = document.querySelector('#close-business-info');
const productDialog = document.querySelector('#product-details');
const productDetailsContent = document.querySelector('#product-details-content');
const closeProductDetailsButton = document.querySelector('#close-product-details');
const configuredTotal = document.querySelector('#configured-total');
const productActionButton = document.querySelector('#add-to-cart');
const productActionLabel = document.querySelector('#product-action-label');
const cartDialog = document.querySelector('#cart-dialog');
const cartContent = document.querySelector('#cart-content');
const cartSummary = document.querySelector('#cart-summary');
const openCartButton = document.querySelector('#open-cart');
const closeCartButton = document.querySelector('#close-cart');
const continueShoppingButton = document.querySelector('#continue-shopping');
const cartBar = document.querySelector('#cart-bar');
const cartBarUnits = document.querySelector('#cart-bar-units');
const cartBarTotal = document.querySelector('#cart-bar-total');
const storageStatus = document.querySelector('#storage-status');
const startCheckoutButton = document.querySelector('#start-checkout');
const checkoutDialog = document.querySelector('#checkout-dialog');
const checkoutForm = document.querySelector('#checkout-form');
const closeCheckoutButton = document.querySelector('#close-checkout');
const checkoutDeliveryFields = document.querySelector('#checkout-delivery-fields');
const checkoutItems = document.querySelector('#checkout-items');
const checkoutProductsTotal = document.querySelector('#checkout-products-total');
const checkoutDeliveryFeeRow = document.querySelector('#checkout-delivery-fee-row');
const checkoutDeliveryFee = document.querySelector('#checkout-delivery-fee');
const checkoutTotal = document.querySelector('#checkout-total');
const checkoutContinueButton = document.querySelector('#checkout-continue');
const checkoutStatus = document.querySelector('#checkout-status');
const checkoutPaymentGroup = document.querySelector('#checkout-payment-group');
const checkoutChangeChoice = document.querySelector('#checkout-change-choice');
const checkoutChangeField = document.querySelector('#checkout-change-field');
const orderReviewDialog = document.querySelector('#order-review-dialog');
const orderReviewContent = document.querySelector('#order-review-content');
const orderReviewSummary = document.querySelector('#order-review-summary');
const orderReviewNotice = document.querySelector('#order-review-notice');
const orderReviewHandoff = document.querySelector('#order-review-handoff');
const backToCheckoutButton = document.querySelector('#back-to-checkout');
const continueToWhatsAppButton = document.querySelector('#continue-to-whatsapp');
const reopenWhatsAppButton = document.querySelector('#reopen-whatsapp');
const alreadySentWhatsAppButton = document.querySelector('#already-sent-whatsapp');
const orderReviewActions = document.querySelector('.order-review-dialog__actions');
const orderReviewStatus = document.querySelector('#order-review-status');

const checkoutInputs = {
    fullName: document.querySelector('#checkout-full-name'),
    phone: document.querySelector('#checkout-phone'),
    street: document.querySelector('#checkout-street'),
    number: document.querySelector('#checkout-number'),
    neighborhood: document.querySelector('#checkout-neighborhood'),
    complement: document.querySelector('#checkout-complement'),
    changeFor: document.querySelector('#checkout-change-for'),
};

const checkoutErrorElements = {
    fulfillmentType: document.querySelector('#checkout-fulfillment-error'),
    fullName: document.querySelector('#checkout-full-name-error'),
    phone: document.querySelector('#checkout-phone-error'),
    street: document.querySelector('#checkout-street-error'),
    number: document.querySelector('#checkout-number-error'),
    neighborhood: document.querySelector('#checkout-neighborhood-error'),
    complement: document.querySelector('#checkout-complement-error'),
    paymentMethod: document.querySelector('#checkout-payment-error'),
    needsChange: document.querySelector('#checkout-needs-change-error'),
    changeFor: document.querySelector('#checkout-change-for-error'),
};

let cart = loadCart();
let currentConfiguration = null;
let productCardThatOpenedDetails = null;
let menuScrollPosition = 0;
let cartReturnFocus = null;
let suppressCartFocusRestore = false;
let suppressCheckoutReturnToCart = false;
let checkoutHasBeenSubmitted = false;
let checkoutData = null;
let isOpeningWhatsApp = false;
let whatsappActionRestoreTimer = null;
let whatsappHandoffStarted = false;
let isFinalizingOrder = false;
let shouldFocusReopenAfterWhatsApp = false;
let suppressOrderReviewReturnToCheckout = false;
let pendingCheckoutErrors = null;
let pendingCheckoutStatus = '';
const checkoutState = {
    fulfillmentType: null,
    fullName: '',
    phone: '',
    street: '',
    number: '',
    neighborhood: '',
    complement: '',
    paymentMethod: null,
    needsChange: null,
    changeFor: '',
};

function formatCurrency(cents) {
    return currencyFormatter.format(cents / 100);
}

function getScrollBehavior() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

function createProductCard(category, product, shouldLoadImmediately) {
    const card = document.createElement('article');
    card.className = 'product-card';
    card.dataset.categoryId = category.id;
    card.dataset.productId = product.id;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Abrir detalhes de ${product.name}`);

    card.addEventListener('click', () => {
        openProductDetails(category.id, product.id, card);
    });

    card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openProductDetails(category.id, product.id, card);
        }
    });

    const content = document.createElement('div');
    content.className = 'product-card__content';

    const name = document.createElement('h3');
    name.className = 'product-card__name';
    name.textContent = product.name;

    const description = document.createElement('p');
    description.className = 'product-card__description';
    description.textContent = product.description;

    const price = document.createElement('p');
    price.className = 'product-card__price';
    price.textContent = formatCurrency(product.price);

    content.append(name, description, price);
    card.append(content);

    const media = document.createElement('div');
    media.className = 'product-card__media';

    if (product.image) {
        const image = document.createElement('img');
        image.className = 'product-card__image';
        image.src = product.image;
        image.alt = product.name;
        image.width = 1024;
        image.height = 1024;
        image.decoding = 'async';

        if (!shouldLoadImmediately) {
            image.loading = 'lazy';
        }

        media.append(image);
    } else {
        media.classList.add('product-card__media--empty');
        media.setAttribute('aria-hidden', 'true');
    }

    card.append(media);

    return card;
}

function renderMenu() {
    const navigationFragment = document.createDocumentFragment();
    const menuFragment = document.createDocumentFragment();
    let renderedProductCount = 0;

    menu.forEach((category, categoryIndex) => {
        const categoryButton = document.createElement('button');
        categoryButton.className = 'category-nav__button';
        categoryButton.type = 'button';
        categoryButton.dataset.categoryId = category.id;
        categoryButton.textContent = category.name;
        categoryButton.setAttribute('aria-pressed', String(categoryIndex === 0));

        if (categoryIndex === 0) {
            categoryButton.classList.add('category-nav__button--active');
        }

        categoryButton.addEventListener('click', () => {
            document.querySelector(`#category-${category.id}`).scrollIntoView({
                behavior: getScrollBehavior(),
                block: 'start',
            });
            setActiveCategory(category.id);
        });

        navigationFragment.append(categoryButton);

        const section = document.createElement('section');
        section.className = 'menu-section';
        section.id = `category-${category.id}`;
        section.dataset.categoryId = category.id;
        section.setAttribute('aria-labelledby', `category-title-${category.id}`);

        const heading = document.createElement('h2');
        heading.className = 'menu-section__title';
        heading.id = `category-title-${category.id}`;
        heading.textContent = category.name;

        const productGrid = document.createElement('div');
        productGrid.className = 'product-grid';

        category.products.forEach((product) => {
            const shouldLoadImmediately = renderedProductCount < 4;
            productGrid.append(createProductCard(category, product, shouldLoadImmediately));
            renderedProductCount += 1;
        });

        section.append(heading, productGrid);
        menuFragment.append(section);
    });

    categoryList.append(navigationFragment);
    menuContent.append(menuFragment);
}

function renderBusinessInfo() {
    businessName.textContent = business.name;
    businessInfoTitle.textContent = business.name;

    const details = document.createElement('div');
    details.className = 'business-details';

    const phoneGroup = createBusinessDetail('Telefone', business.phone);
    const addressGroup = createBusinessDetail('Endereço', business.address);

    const schedule = document.createElement('section');
    schedule.className = 'business-schedule';

    const scheduleTitle = document.createElement('h3');
    scheduleTitle.textContent = 'Horário de funcionamento';

    const scheduleList = document.createElement('dl');
    business.openingHours.forEach(({ day, hours }) => {
        const dayElement = document.createElement('dt');
        dayElement.textContent = day;

        const hoursElement = document.createElement('dd');
        hoursElement.textContent = hours;

        scheduleList.append(dayElement, hoursElement);
    });

    schedule.append(scheduleTitle, scheduleList);
    details.append(phoneGroup, addressGroup, schedule);
    businessInfoContent.append(details);
}

function createBusinessDetail(label, value) {
    const group = document.createElement('section');
    group.className = 'business-detail';

    const heading = document.createElement('h3');
    heading.textContent = label;

    const content = document.createElement('p');
    content.textContent = value;

    group.append(heading, content);
    return group;
}

function setActiveCategory(categoryId) {
    document.querySelectorAll('.category-nav__button').forEach((button) => {
        const isActive = button.dataset.categoryId === categoryId;
        button.classList.toggle('category-nav__button--active', isActive);
        button.setAttribute('aria-pressed', String(isActive));

        if (isActive) {
            const targetLeft =
                button.offsetLeft - (categoryList.clientWidth - button.offsetWidth) / 2;

            categoryList.scrollTo({
                left: targetLeft,
                behavior: getScrollBehavior(),
            });
        }
    });
}

function observeMenuSections() {
    const observer = new IntersectionObserver(
        (entries) => {
            const visibleSections = entries
                .filter((entry) => entry.isIntersecting)
                .sort((first, second) => first.boundingClientRect.top - second.boundingClientRect.top);

            if (visibleSections.length > 0) {
                setActiveCategory(visibleSections[0].target.dataset.categoryId);
            }
        },
        {
            rootMargin: '-110px 0px -65% 0px',
            threshold: 0,
        },
    );

    document.querySelectorAll('.menu-section').forEach((section) => observer.observe(section));
}

function openProductDetails(categoryId, productId, opener) {
    const category = menu.find((item) => item.id === categoryId);
    const product = category?.products.find((item) => item.id === productId);

    if (!category || !product) {
        return;
    }

    currentConfiguration = {
        mode: 'add',
        category,
        product,
        productName: product.name,
        basePrice: product.price,
        availableAddons: category.addons.map((addon) => ({
            id: addon.id,
            name: addon.name,
            price: addon.price,
        })),
        addonQuantities: Object.fromEntries(category.addons.map((addon) => [addon.id, 0])),
        notes: '',
        productQuantity: 1,
        editingLineId: null,
    };
    productCardThatOpenedDetails = opener;
    menuScrollPosition = window.scrollY;

    renderProductDetails();
    productDialog.showModal();
    document.body.classList.add('dialog-open');
    closeProductDetailsButton.focus();
}

function openCartItemEdit(lineId) {
    const line = cart.find((item) => item.id === lineId);
    const menuProduct = line ? findMenuProduct(line.productId) : null;

    if (!line || !menuProduct) {
        return;
    }

    const { category, product } = menuProduct;

    const snapshotAddons = new Map(line.addons.map((addon) => [addon.addonId, addon]));
    const availableAddons = category.addons.map((addon) => ({
        id: addon.id,
        name: snapshotAddons.get(addon.id)?.name ?? addon.name,
        price: snapshotAddons.get(addon.id)?.unitPrice ?? addon.price,
    }));

    line.addons.forEach((addon) => {
        if (!availableAddons.some((item) => item.id === addon.addonId)) {
            availableAddons.push({
                id: addon.addonId,
                name: addon.name,
                price: addon.unitPrice,
            });
        }
    });

    currentConfiguration = {
        mode: 'edit',
        category,
        product,
        productName: line.productName,
        basePrice: line.basePrice,
        availableAddons,
        addonQuantities: Object.fromEntries(
            availableAddons.map((addon) => [
                addon.id,
                snapshotAddons.get(addon.id)?.quantity ?? 0,
            ]),
        ),
        notes: line.notes,
        productQuantity: 1,
        editingLineId: line.id,
    };

    suppressCartFocusRestore = true;
    cartDialog.close();
    renderProductDetails();
    productDialog.showModal();
    document.body.classList.add('dialog-open');
    closeProductDetailsButton.focus();
}

function renderProductDetails() {
    const { product } = currentConfiguration;
    productDetailsContent.textContent = '';

    const productOverview = document.createElement('div');
    productOverview.className = 'product-detail__overview';

    const media = document.createElement('div');
    media.className = 'product-detail__media';

    if (product.image) {
        const image = document.createElement('img');
        image.className = 'product-detail__image';
        image.src = product.image;
        image.alt = product.name;
        image.width = 1024;
        image.height = 1024;
        image.decoding = 'async';
        media.append(image);
    } else {
        media.classList.add('product-detail__media--empty');
        media.setAttribute('aria-hidden', 'true');
    }

    const introduction = document.createElement('div');
    introduction.className = 'product-detail__introduction';

    const name = document.createElement('h2');
    name.className = 'product-detail__name';
    name.id = 'product-details-title';
    name.textContent = product.name;

    const description = document.createElement('p');
    description.className = 'product-detail__description';
    description.textContent = product.description;

    const basePrice = document.createElement('p');
    basePrice.className = 'product-detail__base-price';
    basePrice.textContent = `Preço base: ${formatCurrency(currentConfiguration.basePrice)}`;

    introduction.append(name, description, basePrice);
    productOverview.append(media, introduction);
    productDetailsContent.append(productOverview);

    if (currentConfiguration.availableAddons.length > 0) {
        productDetailsContent.append(
            createAddonsSection(currentConfiguration.availableAddons),
        );
    }

    productDetailsContent.append(createNotesField());

    if (currentConfiguration.mode === 'add') {
        productDetailsContent.append(createProductQuantitySection());
    }

    const summary = document.createElement('section');
    summary.className = 'configuration-summary';
    summary.setAttribute('aria-label', 'Resumo do preço');

    const unitLabel = document.createElement('span');
    unitLabel.textContent = 'Valor unitário configurado';

    const unitPrice = document.createElement('strong');
    unitPrice.id = 'configured-unit-price';

    summary.append(unitLabel, unitPrice);
    productDetailsContent.append(summary);
    productActionLabel.textContent =
        currentConfiguration.mode === 'edit' ? 'Salvar alteração' : 'Adicionar ao carrinho';
    updateConfiguredPrice();
}

function createAddonsSection(addons) {
    const section = document.createElement('section');
    section.className = 'product-options';
    section.setAttribute('aria-labelledby', 'product-options-title');

    const heading = document.createElement('h3');
    heading.id = 'product-options-title';
    heading.textContent = 'Adicionais';

    const description = document.createElement('p');
    description.className = 'product-options__description';
    description.textContent = 'Escolha quantos adicionais desejar.';

    const list = document.createElement('div');
    list.className = 'addon-list';

    addons.forEach((addon) => {
        const row = document.createElement('div');
        row.className = 'addon-row';

        const information = document.createElement('div');
        information.className = 'addon-row__information';

        const name = document.createElement('strong');
        name.textContent = addon.name;

        const price = document.createElement('span');
        price.textContent = `+ ${formatCurrency(addon.price)}`;

        information.append(name, price);
        row.append(
            information,
            createQuantityControl({
                label: addon.name,
                initialQuantity: currentConfiguration.addonQuantities[addon.id] ?? 0,
                minimum: 0,
                onChange: (quantity) => {
                    currentConfiguration.addonQuantities[addon.id] = quantity;
                    updateConfiguredPrice();
                },
            }),
        );
        list.append(row);
    });

    section.append(heading, description, list);
    return section;
}

function createNotesField() {
    const section = document.createElement('section');
    section.className = 'product-notes';

    const label = document.createElement('label');
    label.htmlFor = 'product-notes';
    label.textContent = 'Observações';

    const optional = document.createElement('span');
    optional.textContent = 'Opcional';
    optional.setAttribute('aria-hidden', 'true');
    label.append(optional);

    const textarea = document.createElement('textarea');
    textarea.id = 'product-notes';
    textarea.rows = 3;
    textarea.maxLength = 300;
    textarea.placeholder = 'Ex.: sem cebola, molho à parte...';
    textarea.value = currentConfiguration.notes;
    textarea.addEventListener('input', () => {
        currentConfiguration.notes = textarea.value;
    });

    section.append(label, textarea);
    return section;
}

function createProductQuantitySection() {
    const section = document.createElement('section');
    section.className = 'product-quantity';

    const information = document.createElement('div');
    const heading = document.createElement('h3');
    heading.textContent = 'Quantidade';

    const description = document.createElement('p');
    description.textContent = 'Quantas unidades deste produto?';

    information.append(heading, description);
    section.append(
        information,
        createQuantityControl({
            label: currentConfiguration.product.name,
            initialQuantity: 1,
            minimum: 1,
            onChange: (quantity) => {
                currentConfiguration.productQuantity = quantity;
                updateConfiguredPrice();
            },
        }),
    );

    return section;
}

function createQuantityControl({ label, initialQuantity, minimum, onChange }) {
    let quantity = initialQuantity;

    const control = document.createElement('div');
    control.className = 'quantity-control';

    const decreaseButton = document.createElement('button');
    decreaseButton.className = 'quantity-control__button';
    decreaseButton.type = 'button';
    decreaseButton.textContent = '−';
    decreaseButton.setAttribute('aria-label', `Remover ${label}`);

    const value = document.createElement('span');
    value.className = 'quantity-control__value';
    value.textContent = String(quantity);
    value.setAttribute('aria-live', 'off');

    const increaseButton = document.createElement('button');
    increaseButton.className = 'quantity-control__button';
    increaseButton.type = 'button';
    increaseButton.textContent = '+';
    increaseButton.setAttribute('aria-label', `Adicionar ${label}`);

    function refreshControl() {
        value.textContent = String(quantity);
        decreaseButton.disabled = quantity === minimum;
        onChange(quantity);
    }

    decreaseButton.addEventListener('click', () => {
        if (quantity > minimum) {
            quantity -= 1;
            refreshControl();
        }
    });

    increaseButton.addEventListener('click', () => {
        quantity += 1;
        refreshControl();
    });

    control.append(decreaseButton, value, increaseButton);
    decreaseButton.disabled = quantity === minimum;
    return control;
}

function calculateConfiguredPrices() {
    const addonsTotal = currentConfiguration.availableAddons.reduce(
        (total, addon) =>
            total + addon.price * currentConfiguration.addonQuantities[addon.id],
        0,
    );
    const unitPrice = currentConfiguration.basePrice + addonsTotal;

    return {
        unitPrice,
        total: unitPrice * currentConfiguration.productQuantity,
    };
}

function updateConfiguredPrice() {
    const prices = calculateConfiguredPrices();
    document.querySelector('#configured-unit-price').textContent = formatCurrency(prices.unitPrice);
    configuredTotal.textContent = formatCurrency(prices.total);
}

function getCurrentCartConfiguration() {
    return {
        productId: currentConfiguration.product.id,
        productName: currentConfiguration.productName,
        basePrice: currentConfiguration.basePrice,
        addons: currentConfiguration.availableAddons
            .filter((addon) => currentConfiguration.addonQuantities[addon.id] > 0)
            .map((addon) => ({
                addonId: addon.id,
                name: addon.name,
                unitPrice: addon.price,
                quantity: currentConfiguration.addonQuantities[addon.id],
            })),
        notes: currentConfiguration.notes,
        quantity: currentConfiguration.productQuantity,
    };
}

function hasCartChanged(currentCart, nextCart) {
    // cart.js returns canonical plain-data snapshots. This exact comparison only
    // prevents no-op persistence; equivalence and mutation rules remain in the engine.
    return JSON.stringify(currentCart) !== JSON.stringify(nextCart);
}

function persistCart(nextCart) {
    const shouldSave = hasCartChanged(cart, nextCart);
    cart = nextCart;

    if (!shouldSave) {
        renderCartBar();
        return false;
    }

    const wasSaved = saveCart(cart);
    storageStatus.textContent = wasSaved
        ? ''
        : 'Não foi possível salvar o carrinho neste dispositivo.';
    renderCartBar();
    return wasSaved;
}

function findMenuProduct(productId) {
    const category = menu.find((item) =>
        item.products.some((product) => product.id === productId),
    );
    const product = category?.products.find((item) => item.id === productId);

    return category && product ? { category, product } : null;
}

function renderCheckoutSummary() {
    const totalUnits = getCartTotalUnits(cart);
    const productsTotal = getCartTotal(cart);
    const totals = getCheckoutTotals(
        checkoutState.fulfillmentType,
        productsTotal,
        business.deliveryFee,
    );

    checkoutItems.textContent = `${totalUnits} ${totalUnits === 1 ? 'item' : 'itens'}`;
    checkoutProductsTotal.textContent = formatCurrency(productsTotal);
    checkoutDeliveryFeeRow.hidden = checkoutState.fulfillmentType !== 'delivery';
    checkoutDeliveryFee.textContent =
        totals.deliveryFee === 0 ? 'Grátis' : formatCurrency(totals.deliveryFee);
    checkoutTotal.textContent = formatCurrency(totals.total);
}

function updateCheckoutFulfillment() {
    const isDelivery = checkoutState.fulfillmentType === 'delivery';
    checkoutDeliveryFields.hidden = !isDelivery;
    renderCheckoutSummary();
}

function updateCheckoutPaymentFields() {
    const isCash = checkoutState.paymentMethod === 'cash';
    checkoutChangeChoice.hidden = !isCash;
    checkoutChangeField.hidden = !isCash || checkoutState.needsChange !== true;
}

function renderCheckoutErrors(errors = {}) {
    const groupFields = {
        fulfillmentType: {
            element: document.querySelector('#checkout-fulfillment-group'),
            inputs: checkoutForm.querySelectorAll('[name="fulfillment"]'),
        },
        paymentMethod: {
            element: checkoutPaymentGroup,
            inputs: checkoutForm.querySelectorAll('[name="paymentMethod"]'),
        },
        needsChange: {
            element: checkoutChangeChoice,
            inputs: checkoutForm.querySelectorAll('[name="needsChange"]'),
        },
    };

    Object.entries(checkoutErrorElements).forEach(([field, element]) => {
        element.textContent = errors[field] ?? '';

        if (groupFields[field]) {
            const isInvalid = Boolean(errors[field]);
            groupFields[field].element.setAttribute('aria-invalid', String(isInvalid));
            groupFields[field].inputs.forEach((input) =>
                input.setAttribute('aria-invalid', String(isInvalid)),
            );
            return;
        }

        checkoutInputs[field].setAttribute('aria-invalid', String(Boolean(errors[field])));
    });
}

function validateAndRenderCheckout() {
    const validation = validateCheckoutDetails(
        checkoutState,
        getCartTotal(cart),
        business.deliveryFee,
    );
    renderCheckoutErrors(validation.errors);
    return validation;
}

function updateCheckoutAfterInput() {
    checkoutData = null;
    checkoutStatus.textContent = '';

    if (orderReviewDialog.open) {
        getCurrentWhatsAppButton().disabled = true;
    }

    if (checkoutHasBeenSubmitted) {
        validateAndRenderCheckout();
    }
}

function renderCheckout() {
    checkoutForm.querySelectorAll('[name="fulfillment"]').forEach((input) => {
        input.checked = input.value === checkoutState.fulfillmentType;
    });

    checkoutForm.querySelectorAll('[name="paymentMethod"]').forEach((input) => {
        input.checked = input.value === checkoutState.paymentMethod;
    });

    checkoutForm.querySelectorAll('[name="needsChange"]').forEach((input) => {
        const needsChange = input.value === 'yes';
        input.checked = needsChange === checkoutState.needsChange;
    });

    Object.entries(checkoutInputs).forEach(([field, input]) => {
        input.value = checkoutState[field];
    });

    checkoutHasBeenSubmitted = false;
    checkoutData = null;
    checkoutStatus.textContent = '';
    renderCheckoutErrors();
    updateCheckoutFulfillment();
    updateCheckoutPaymentFields();
    checkoutContinueButton.disabled = cart.length === 0;
}

function openCheckout() {
    if (cart.length === 0) {
        return;
    }

    suppressCartFocusRestore = true;
    cartDialog.close();
    renderCheckout();
    checkoutDialog.showModal();
    document.body.classList.add('dialog-open');
    closeCheckoutButton.focus();
}

function closeCheckout() {
    checkoutDialog.close();
}

function focusFirstCheckoutError(errors) {
    const order = [
        'fulfillmentType',
        'fullName',
        'phone',
        'street',
        'number',
        'neighborhood',
        'complement',
        'paymentMethod',
        'needsChange',
        'changeFor',
    ];
    const firstInvalidField = order.find((field) => errors[field]);

    if (firstInvalidField === 'fulfillmentType') {
        checkoutForm.querySelector('[name="fulfillment"]')?.focus();
        return;
    }

    if (firstInvalidField === 'paymentMethod') {
        checkoutForm.querySelector('[name="paymentMethod"]')?.focus();
        return;
    }

    if (firstInvalidField === 'needsChange') {
        checkoutForm.querySelector('[name="needsChange"]')?.focus();
        return;
    }

    checkoutInputs[firstInvalidField]?.focus();
}

function createOrderReviewSection(title) {
    const section = document.createElement('section');
    section.className = 'order-review-section';

    const heading = document.createElement('h3');
    heading.textContent = title;
    section.append(heading);

    return section;
}

function createOrderReviewDetails(entries) {
    const list = document.createElement('dl');
    list.className = 'order-review-details';

    entries.forEach(({ label, value, emphasis = false }) => {
        const row = document.createElement('div');
        const term = document.createElement('dt');
        const description = document.createElement('dd');

        term.textContent = label;
        description.textContent = value;
        row.classList.toggle('order-review-details__total', emphasis);
        row.append(term, description);
        list.append(row);
    });

    return list;
}

function renderOrderReviewCustomer(fragment) {
    const section = createOrderReviewSection('Cliente');
    section.append(
        createOrderReviewDetails([
            { label: 'Nome', value: checkoutData.customer.fullName },
            { label: 'Telefone', value: formatPhone(checkoutData.customer.phone) },
        ]),
    );
    fragment.append(section);
}

function renderOrderReviewFulfillment(fragment) {
    const section = createOrderReviewSection('Recebimento');
    const entries = [
        {
            label: 'Forma de recebimento',
            value: checkoutData.fulfillmentType === 'delivery' ? 'Delivery' : 'Retirada',
        },
    ];

    if (checkoutData.delivery) {
        entries.push(
            {
                label: 'Endereço',
                value: `${checkoutData.delivery.street}, ${checkoutData.delivery.number}`,
            },
            { label: 'Bairro', value: checkoutData.delivery.neighborhood },
        );

        if (checkoutData.delivery.complement) {
            entries.push({
                label: 'Complemento ou referência',
                value: checkoutData.delivery.complement,
            });
        }
    }

    section.append(createOrderReviewDetails(entries));
    fragment.append(section);
}

function createOrderReviewItem(line) {
    const article = document.createElement('article');
    article.className = 'order-review-item';

    const heading = document.createElement('h4');
    heading.textContent = `${line.quantity}× ${line.productName}`;
    article.append(heading);

    if (line.addons.length > 0) {
        const addons = document.createElement('div');
        addons.className = 'order-review-item__addons';

        const label = document.createElement('span');
        label.textContent = 'Adicionais:';

        const list = document.createElement('ul');
        line.addons.forEach((addon) => {
            const item = document.createElement('li');
            item.textContent = `${addon.name} ×${addon.quantity}`;
            list.append(item);
        });

        addons.append(label, list);
        article.append(addons);
    }

    if (line.notes) {
        const notes = document.createElement('p');
        notes.className = 'order-review-item__notes';
        notes.textContent = `Obs.: ${line.notes}`;
        article.append(notes);
    }

    const pricing = document.createElement('div');
    pricing.className = 'order-review-item__pricing';

    const unitPrice = document.createElement('span');
    unitPrice.textContent = `${formatCurrency(line.unitPrice)} cada`;

    const subtotal = document.createElement('strong');
    subtotal.textContent = formatCurrency(line.unitPrice * line.quantity);

    pricing.append(unitPrice, subtotal);
    article.append(pricing);
    return article;
}

function renderOrderReviewItems(fragment) {
    const totalUnits = getCartTotalUnits(cart);
    const section = createOrderReviewSection('Itens');
    const count = document.createElement('p');
    count.className = 'order-review-section__description';
    count.textContent = `${totalUnits} ${totalUnits === 1 ? 'item' : 'itens'}`;

    const list = document.createElement('div');
    list.className = 'order-review-items';
    cart.forEach((line) => list.append(createOrderReviewItem(line)));

    section.append(count, list);
    fragment.append(section);
}

function renderOrderReviewPayment(fragment) {
    const section = createOrderReviewSection('Pagamento');
    const paymentLabels = {
        pix: 'Pix',
        card: 'Cartão',
        cash: 'Dinheiro',
    };
    const entries = [
        {
            label: 'Forma de pagamento',
            value: paymentLabels[checkoutData.payment.method],
        },
    ];

    if (checkoutData.payment.method === 'cash') {
        if (checkoutData.payment.needsChange) {
            entries.push(
                {
                    label: 'Troco para',
                    value: formatCurrency(checkoutData.payment.changeFor),
                },
                {
                    label: 'Troco',
                    value: formatCurrency(checkoutData.payment.changeAmount),
                },
            );
        } else {
            entries.push({ label: 'Troco', value: 'Sem necessidade de troco' });
        }
    }

    section.append(createOrderReviewDetails(entries));
    fragment.append(section);
}

function renderOrderReviewTotals(fragment) {
    const section = createOrderReviewSection('Resumo');
    const entries = [
        {
            label: 'Subtotal dos produtos',
            value: formatCurrency(checkoutData.productsTotal),
        },
    ];

    if (checkoutData.fulfillmentType === 'delivery') {
        entries.push({
            label: 'Taxa de entrega',
            value:
                checkoutData.deliveryFee === 0
                    ? 'Grátis'
                    : formatCurrency(checkoutData.deliveryFee),
        });
    }

    entries.push({
        label: 'Total',
        value: formatCurrency(checkoutData.total),
        emphasis: true,
    });

    section.append(createOrderReviewDetails(entries));
    fragment.append(section);
}

function renderOrderReview() {
    const fragment = document.createDocumentFragment();
    orderReviewSummary.textContent = '';

    renderOrderReviewCustomer(fragment);
    renderOrderReviewFulfillment(fragment);
    renderOrderReviewItems(fragment);
    renderOrderReviewPayment(fragment);
    renderOrderReviewTotals(fragment);

    orderReviewSummary.append(fragment);
}

function getCurrentWhatsAppButton() {
    return whatsappHandoffStarted ? reopenWhatsAppButton : continueToWhatsAppButton;
}

function setWhatsAppHandoffState(isStarted, { focusReopen = false } = {}) {
    whatsappHandoffStarted = isStarted;
    shouldFocusReopenAfterWhatsApp = isStarted && focusReopen;
    orderReviewNotice.hidden = isStarted;
    orderReviewHandoff.hidden = !isStarted;
    continueToWhatsAppButton.hidden = isStarted;
    continueToWhatsAppButton.disabled =
        isStarted || isOpeningWhatsApp || isFinalizingOrder;
    reopenWhatsAppButton.hidden = !isStarted;
    reopenWhatsAppButton.disabled = !isStarted || isOpeningWhatsApp || isFinalizingOrder;
    alreadySentWhatsAppButton.hidden = !isStarted;
    alreadySentWhatsAppButton.disabled = !isStarted || isFinalizingOrder;
    orderReviewActions.classList.toggle(
        'order-review-dialog__actions--post-handoff',
        isStarted,
    );

    if (isStarted && focusReopen) {
        orderReviewContent.scrollTo({ top: 0, behavior: 'auto' });
    }
}

function openOrderReview() {
    if (getCartTotalUnits(cart) === 0 || !checkoutData) {
        return;
    }

    cancelWhatsAppActionRestore();
    isOpeningWhatsApp = false;
    orderReviewStatus.textContent = '';
    setWhatsAppHandoffState(false);
    continueToWhatsAppButton.disabled = true;
    renderOrderReview();
    suppressCheckoutReturnToCart = true;
    checkoutDialog.close();
    orderReviewDialog.showModal();
    continueToWhatsAppButton.disabled = false;
    orderReviewContent.scrollTo({ top: 0, behavior: 'auto' });
    document.body.classList.add('dialog-open');
    backToCheckoutButton.focus();
}

function closeOrderReview() {
    if (isFinalizingOrder) {
        return;
    }

    cancelWhatsAppActionRestore();
    isOpeningWhatsApp = false;
    setWhatsAppHandoffState(false);
    continueToWhatsAppButton.disabled = true;
    orderReviewStatus.textContent = '';
    orderReviewDialog.close();
}

function returnToCheckoutFromInvalidReview(errors = null, status = '') {
    checkoutData = null;
    pendingCheckoutErrors = errors;
    pendingCheckoutStatus = status;
    closeOrderReview();
}

function restoreWhatsAppAction() {
    whatsappActionRestoreTimer = null;

    if (isFinalizingOrder) {
        return;
    }

    isOpeningWhatsApp = false;

    if (orderReviewDialog.open && checkoutData) {
        const currentWhatsAppButton = getCurrentWhatsAppButton();
        currentWhatsAppButton.disabled = false;

        if (whatsappHandoffStarted && shouldFocusReopenAfterWhatsApp) {
            shouldFocusReopenAfterWhatsApp = false;
            reopenWhatsAppButton.focus({ preventScroll: true });
        }
    }
}

function cancelWhatsAppActionRestore() {
    if (whatsappActionRestoreTimer !== null) {
        window.clearTimeout(whatsappActionRestoreTimer);
        whatsappActionRestoreTimer = null;
    }
}

function scheduleWhatsAppActionRestore() {
    cancelWhatsAppActionRestore();
    whatsappActionRestoreTimer = window.setTimeout(
        restoreWhatsAppAction,
        WHATSAPP_REENTRY_DELAY_MS,
    );
}

function handleOpenWhatsApp() {
    const currentWhatsAppButton = getCurrentWhatsAppButton();

    if (isFinalizingOrder || isOpeningWhatsApp || currentWhatsAppButton.disabled) {
        return;
    }

    isOpeningWhatsApp = true;
    currentWhatsAppButton.disabled = true;
    orderReviewStatus.textContent = '';

    if (cart.length === 0) {
        checkoutContinueButton.disabled = true;
        returnToCheckoutFromInvalidReview(null, 'Seu carrinho está vazio.');
        return;
    }

    try {
        const validation = validateAndRenderCheckout();

        if (!validation.isValid) {
            returnToCheckoutFromInvalidReview(validation.errors);
            return;
        }

        const currentCheckoutData = buildCheckoutDetails(
            checkoutState,
            getCartTotal(cart),
            business.deliveryFee,
        );
        const message = buildWhatsAppMessage(cart, currentCheckoutData, business);
        const url = buildWhatsAppUrl(business.whatsapp, message);

        checkoutData = currentCheckoutData;
        renderOrderReview();

        let whatsappWindow;

        try {
            whatsappWindow = window.open(url, '_blank');
        } catch {
            orderReviewStatus.textContent =
                'Não foi possível abrir o WhatsApp. Tente novamente.';
            scheduleWhatsAppActionRestore();
            return;
        }

        if (whatsappWindow === null) {
            orderReviewStatus.textContent =
                'Não foi possível abrir o WhatsApp. Tente novamente.';
            scheduleWhatsAppActionRestore();
            return;
        }

        try {
            whatsappWindow.opener = null;
        } catch {
            try {
                whatsappWindow.close();
            } catch {
                // The external window may deny access after it has opened.
            }

            orderReviewStatus.textContent =
                'Não foi possível abrir o WhatsApp. Tente novamente.';
            scheduleWhatsAppActionRestore();
            return;
        }

        const isFirstHandoff = !whatsappHandoffStarted;
        setWhatsAppHandoffState(true, { focusReopen: isFirstHandoff });
        scheduleWhatsAppActionRestore();
    } catch {
        orderReviewStatus.textContent =
            'Não foi possível preparar o pedido para o WhatsApp.';
        scheduleWhatsAppActionRestore();
    }
}

function resetCheckoutSession() {
    checkoutState.fulfillmentType = null;
    checkoutState.fullName = '';
    checkoutState.phone = '';
    checkoutState.street = '';
    checkoutState.number = '';
    checkoutState.neighborhood = '';
    checkoutState.complement = '';
    checkoutState.paymentMethod = null;
    checkoutState.needsChange = null;
    checkoutState.changeFor = '';
    checkoutHasBeenSubmitted = false;
    checkoutData = null;
    pendingCheckoutErrors = null;
    pendingCheckoutStatus = '';
    renderCheckout();
}

function resetInterfaceAfterOrderDiscard() {
    cart = [];
    resetCheckoutSession();
    cancelWhatsAppActionRestore();
    isOpeningWhatsApp = false;
    shouldFocusReopenAfterWhatsApp = false;
    setWhatsAppHandoffState(false);
    orderReviewStatus.textContent = '';
    orderReviewSummary.textContent = '';
    storageStatus.textContent = '';
    cartReturnFocus = null;

    suppressOrderReviewReturnToCheckout = true;

    if (orderReviewDialog.open) {
        orderReviewDialog.close();
    }

    if (checkoutDialog.open) {
        suppressCheckoutReturnToCart = true;
        checkoutDialog.close();
    }

    if (cartDialog.open) {
        suppressCartFocusRestore = true;
        cartDialog.close();
    }

    renderCart();
    renderCartBar();
    document.body.classList.remove('dialog-open');
    isFinalizingOrder = false;
    backToCheckoutButton.disabled = false;
}

function handleAlreadySentOrder() {
    if (!whatsappHandoffStarted || isFinalizingOrder) {
        return;
    }

    isFinalizingOrder = true;
    backToCheckoutButton.disabled = true;
    continueToWhatsAppButton.disabled = true;
    reopenWhatsAppButton.disabled = true;
    alreadySentWhatsAppButton.disabled = true;
    orderReviewStatus.textContent = '';

    let wasCleared = false;

    try {
        wasCleared = clearCartStorage();
    } catch {
        wasCleared = false;
    }

    if (!wasCleared) {
        isFinalizingOrder = false;
        cancelWhatsAppActionRestore();
        isOpeningWhatsApp = false;
        shouldFocusReopenAfterWhatsApp = false;
        backToCheckoutButton.disabled = false;
        setWhatsAppHandoffState(true);
        orderReviewStatus.textContent =
            'Não foi possível limpar este pedido do dispositivo. Tente novamente.';
        alreadySentWhatsAppButton.focus({ preventScroll: true });
        return;
    }

    resetInterfaceAfterOrderDiscard();

    try {
        window.location.reload();
    } catch {
        // The local state is already safely reset if reloading is unavailable.
    }
}

function handleCheckoutSubmit(event) {
    event.preventDefault();

    if (cart.length === 0) {
        checkoutContinueButton.disabled = true;
        closeCheckout();
        return;
    }

    checkoutHasBeenSubmitted = true;
    const validation = validateAndRenderCheckout();

    if (!validation.isValid) {
        checkoutData = null;
        checkoutStatus.textContent = '';
        focusFirstCheckoutError(validation.errors);
        return;
    }

    checkoutData = buildCheckoutDetails(
        checkoutState,
        getCartTotal(cart),
        business.deliveryFee,
    );
    checkoutStatus.textContent = '';
    openOrderReview();
}

function renderCartBar() {
    const totalUnits = getCartTotalUnits(cart);
    const isVisible = totalUnits > 0;

    cartBar.hidden = !isVisible;
    startCheckoutButton.disabled = !isVisible;
    document.body.classList.toggle('cart-bar-visible', isVisible);

    if (!isVisible) {
        return;
    }

    const itemLabel = totalUnits === 1 ? 'item' : 'itens';
    const total = formatCurrency(getCartTotal(cart));
    cartBarUnits.textContent = `${totalUnits} ${itemLabel}`;
    cartBarTotal.textContent = total;
    openCartButton.setAttribute(
        'aria-label',
        `Abrir carrinho com ${totalUnits} ${itemLabel}, total ${total}`,
    );
}

function createCartLine(line, lineIndex) {
    const article = document.createElement('article');
    article.className = 'cart-line';
    article.dataset.lineId = line.id;

    const heading = document.createElement('h3');
    heading.className = 'cart-line__name';
    heading.textContent = line.productName;
    article.append(heading);

    if (line.addons.length > 0) {
        const addons = document.createElement('div');
        addons.className = 'cart-line__addons';

        const label = document.createElement('span');
        label.textContent = 'Adicionais:';

        const list = document.createElement('ul');
        line.addons.forEach((addon) => {
            const item = document.createElement('li');
            item.textContent = `${addon.name} ×${addon.quantity}`;
            list.append(item);
        });

        addons.append(label, list);
        article.append(addons);
    }

    if (line.notes) {
        const notes = document.createElement('p');
        notes.className = 'cart-line__notes';
        notes.textContent = `Obs.: ${line.notes}`;
        article.append(notes);
    }

    const pricing = document.createElement('div');
    pricing.className = 'cart-line__pricing';

    const unitPrice = document.createElement('span');
    unitPrice.textContent = `${formatCurrency(line.unitPrice)} cada`;

    const subtotal = document.createElement('strong');
    subtotal.textContent = formatCurrency(line.unitPrice * line.quantity);

    pricing.append(unitPrice, subtotal);

    const menuProduct = findMenuProduct(line.productId);

    if (!menuProduct) {
        const availability = document.createElement('p');
        availability.className = 'cart-line__availability';
        availability.id = `cart-line-availability-${lineIndex}`;
        availability.textContent = 'Este item não está mais disponível para edição.';
        article.append(availability);
    }

    const controls = document.createElement('div');
    controls.className = 'cart-line__controls';

    const quantityControl = document.createElement('div');
    quantityControl.className = 'quantity-control';

    const decrease = document.createElement('button');
    decrease.className = 'quantity-control__button';
    decrease.type = 'button';
    decrease.textContent = '−';
    decrease.disabled = line.quantity === 1;
    decrease.dataset.cartAction = 'decrease';
    decrease.setAttribute('aria-label', `Remover uma unidade de ${line.productName}`);
    decrease.addEventListener('click', () => {
        if (line.quantity === 1) {
            return;
        }

        persistCart(decrementCartItem(cart, line.id));
        renderCart(line.id, 'decrease');
    });

    const quantity = document.createElement('span');
    quantity.className = 'quantity-control__value';
    quantity.textContent = String(line.quantity);

    const increase = document.createElement('button');
    increase.className = 'quantity-control__button';
    increase.type = 'button';
    increase.textContent = '+';
    increase.dataset.cartAction = 'increase';
    increase.setAttribute('aria-label', `Adicionar uma unidade de ${line.productName}`);
    increase.addEventListener('click', () => {
        persistCart(incrementCartItem(cart, line.id));
        renderCart(line.id, 'increase');
    });

    quantityControl.append(decrease, quantity, increase);

    const actions = document.createElement('div');
    actions.className = 'cart-line__actions';

    const edit = document.createElement('button');
    edit.className = 'text-button';
    edit.type = 'button';
    edit.textContent = 'Editar';
    edit.setAttribute('aria-label', `Editar ${line.productName}`);
    edit.disabled = !menuProduct;

    if (menuProduct) {
        edit.addEventListener('click', () => openCartItemEdit(line.id));
    } else {
        edit.setAttribute('aria-describedby', `cart-line-availability-${lineIndex}`);
    }

    const remove = document.createElement('button');
    remove.className = 'text-button text-button--danger';
    remove.type = 'button';
    remove.textContent = 'Remover';
    remove.setAttribute('aria-label', `Remover ${line.productName} do carrinho`);
    remove.addEventListener('click', () => {
        persistCart(removeCartItem(cart, line.id));
        const nextLine = cart[Math.min(lineIndex, cart.length - 1)];
        renderCart(nextLine?.id ?? null, nextLine ? 'edit' : 'empty');
    });

    actions.append(edit, remove);
    controls.append(quantityControl, actions);
    article.append(pricing, controls);
    return article;
}

function renderCart(focusLineId = null, focusAction = null) {
    cartContent.textContent = '';

    if (cart.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'cart-empty';

        const emptyText = document.createElement('p');
        emptyText.textContent = 'Seu carrinho está vazio.';
        empty.append(emptyText);
        cartContent.append(empty);
    } else {
        const list = document.createElement('div');
        list.className = 'cart-list';
        cart.forEach((line, index) => list.append(createCartLine(line, index)));
        cartContent.append(list);
    }

    const totalUnits = getCartTotalUnits(cart);
    const itemLabel = totalUnits === 1 ? 'item' : 'itens';
    cartSummary.textContent = `${totalUnits} ${itemLabel} • Total: ${formatCurrency(
        getCartTotal(cart),
    )}`;

    if (!cartDialog.open || !focusAction) {
        return;
    }

    if (focusAction === 'empty') {
        closeCartButton.focus();
        return;
    }

    const line = cartContent.querySelector(`[data-line-id="${CSS.escape(focusLineId)}"]`);
    const selector =
        focusAction === 'edit'
            ? 'button[aria-label^="Editar"]'
            : `button[data-cart-action="${focusAction}"]`;
    line?.querySelector(selector)?.focus();
}

function openCart() {
    cartReturnFocus = document.activeElement;
    renderCart();
    cartDialog.showModal();
    document.body.classList.add('dialog-open');
    closeCartButton.focus();
}

function closeCart() {
    cartDialog.close();
}

function handleProductAction() {
    const configuration = getCurrentCartConfiguration();

    if (currentConfiguration.mode === 'edit') {
        persistCart(
            editCartItem(cart, currentConfiguration.editingLineId, configuration),
        );
        renderCart();
    } else {
        persistCart(addCartItem(cart, configuration));
    }

    closeProductDetails();
}

function closeProductDetails() {
    productDialog.close();
}

function openBusinessInfo() {
    businessDialog.showModal();
    document.body.classList.add('dialog-open');
    closeBusinessInfoButton.focus();
}

function closeBusinessInfo() {
    businessDialog.close();
}

openBusinessInfoButton.addEventListener('click', openBusinessInfo);
closeBusinessInfoButton.addEventListener('click', closeBusinessInfo);

businessDialog.addEventListener('click', (event) => {
    if (event.target === businessDialog) {
        closeBusinessInfo();
    }
});

businessDialog.addEventListener('close', () => {
    document.body.classList.remove('dialog-open');
    openBusinessInfoButton.focus();
});

businessDialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        event.preventDefault();
        closeBusinessInfo();
    }
});

closeProductDetailsButton.addEventListener('click', closeProductDetails);
productActionButton.addEventListener('click', handleProductAction);
openCartButton.addEventListener('click', openCart);
closeCartButton.addEventListener('click', closeCart);
continueShoppingButton.addEventListener('click', closeCart);
startCheckoutButton.addEventListener('click', openCheckout);
closeCheckoutButton.addEventListener('click', closeCheckout);
checkoutForm.addEventListener('submit', handleCheckoutSubmit);
backToCheckoutButton.addEventListener('click', closeOrderReview);
continueToWhatsAppButton.addEventListener('click', handleOpenWhatsApp);
reopenWhatsAppButton.addEventListener('click', handleOpenWhatsApp);
alreadySentWhatsAppButton.addEventListener('click', handleAlreadySentOrder);

checkoutForm.querySelectorAll('[name="fulfillment"]').forEach((input) => {
    input.addEventListener('change', () => {
        checkoutState.fulfillmentType = input.value;
        updateCheckoutFulfillment();
        updateCheckoutAfterInput();
    });
});

checkoutForm.querySelectorAll('[name="paymentMethod"]').forEach((input) => {
    input.addEventListener('change', () => {
        checkoutState.paymentMethod = input.value;
        updateCheckoutPaymentFields();
        updateCheckoutAfterInput();
    });
});

checkoutForm.querySelectorAll('[name="needsChange"]').forEach((input) => {
    input.addEventListener('change', () => {
        checkoutState.needsChange = input.value === 'yes';
        updateCheckoutPaymentFields();
        updateCheckoutAfterInput();
    });
});

Object.entries(checkoutInputs).forEach(([field, input]) => {
    input.addEventListener('input', () => {
        if (field === 'phone') {
            input.value = formatPhone(input.value);
        }

        checkoutState[field] = input.value;
        updateCheckoutAfterInput();
    });
});

productDialog.addEventListener('click', (event) => {
    if (event.target === productDialog) {
        closeProductDetails();
    }
});

productDialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        event.preventDefault();
        closeProductDetails();
    }
});

productDialog.addEventListener('close', () => {
    const shouldReturnToCart = currentConfiguration?.mode === 'edit';
    currentConfiguration = null;
    productDetailsContent.textContent = '';

    if (shouldReturnToCart) {
        renderCart();
        cartDialog.showModal();
        document.body.classList.add('dialog-open');
        closeCartButton.focus();
        return;
    }

    document.body.classList.remove('dialog-open');
    window.scrollTo({ top: menuScrollPosition, behavior: 'auto' });
    productCardThatOpenedDetails?.focus({ preventScroll: true });
});

cartDialog.addEventListener('click', (event) => {
    if (event.target === cartDialog) {
        closeCart();
    }
});

cartDialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        event.preventDefault();
        closeCart();
    }
});

cartDialog.addEventListener('close', () => {
    if (suppressCartFocusRestore) {
        suppressCartFocusRestore = false;
        return;
    }

    document.body.classList.remove('dialog-open');

    if (!cartBar.hidden) {
        openCartButton.focus();
    } else if (
        cartReturnFocus instanceof HTMLElement &&
        cartReturnFocus.isConnected &&
        cartReturnFocus !== openCartButton
    ) {
        cartReturnFocus.focus({ preventScroll: true });
    } else {
        document.querySelector('.product-card')?.focus({ preventScroll: true });
    }
});

checkoutDialog.addEventListener('click', (event) => {
    if (event.target === checkoutDialog) {
        closeCheckout();
    }
});

checkoutDialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        event.preventDefault();
        closeCheckout();
    }
});

checkoutDialog.addEventListener('close', () => {
    if (suppressCheckoutReturnToCart) {
        suppressCheckoutReturnToCart = false;
        return;
    }

    renderCart();
    cartDialog.showModal();
    document.body.classList.add('dialog-open');
    startCheckoutButton.focus();
});

orderReviewDialog.addEventListener('click', (event) => {
    if (event.target === orderReviewDialog) {
        closeOrderReview();
    }
});

orderReviewDialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        event.preventDefault();
        closeOrderReview();
    }
});

orderReviewDialog.addEventListener('close', () => {
    if (suppressOrderReviewReturnToCheckout) {
        suppressOrderReviewReturnToCheckout = false;
        return;
    }

    checkoutDialog.showModal();
    document.body.classList.add('dialog-open');

    if (pendingCheckoutStatus) {
        checkoutStatus.textContent = pendingCheckoutStatus;
    }

    if (pendingCheckoutErrors) {
        focusFirstCheckoutError(pendingCheckoutErrors);
    } else {
        checkoutContinueButton.focus();
    }

    pendingCheckoutErrors = null;
    pendingCheckoutStatus = '';
});

renderMenu();
renderBusinessInfo();
observeMenuSections();
renderCartBar();
