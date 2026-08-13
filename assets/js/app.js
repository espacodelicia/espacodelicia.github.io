import { business } from './business.js';
import { menu } from './menu.js';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
});

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

let currentConfiguration = null;
let productCardThatOpenedDetails = null;
let menuScrollPosition = 0;

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
        category,
        product,
        addonQuantities: Object.fromEntries(category.addons.map((addon) => [addon.id, 0])),
        notes: '',
        productQuantity: 1,
    };
    productCardThatOpenedDetails = opener;
    menuScrollPosition = window.scrollY;

    renderProductDetails();
    productDialog.showModal();
    document.body.classList.add('dialog-open');
    closeProductDetailsButton.focus();
}

function renderProductDetails() {
    const { category, product } = currentConfiguration;
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
    basePrice.textContent = `Preço base: ${formatCurrency(product.price)}`;

    introduction.append(name, description, basePrice);
    productOverview.append(media, introduction);
    productDetailsContent.append(productOverview);

    if (category.addons.length > 0) {
        productDetailsContent.append(createAddonsSection(category.addons));
    }

    productDetailsContent.append(createNotesField(), createProductQuantitySection());

    const summary = document.createElement('section');
    summary.className = 'configuration-summary';
    summary.setAttribute('aria-label', 'Resumo do preço');

    const unitLabel = document.createElement('span');
    unitLabel.textContent = 'Valor unitário configurado';

    const unitPrice = document.createElement('strong');
    unitPrice.id = 'configured-unit-price';

    summary.append(unitLabel, unitPrice);
    productDetailsContent.append(summary);
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
                initialQuantity: 0,
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
    const addonsTotal = currentConfiguration.category.addons.reduce(
        (total, addon) =>
            total + addon.price * currentConfiguration.addonQuantities[addon.id],
        0,
    );
    const unitPrice = currentConfiguration.product.price + addonsTotal;

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
    document.body.classList.remove('dialog-open');
    window.scrollTo({ top: menuScrollPosition, behavior: 'auto' });
    productCardThatOpenedDetails?.focus({ preventScroll: true });
    currentConfiguration = null;
    productDetailsContent.textContent = '';
});

renderMenu();
renderBusinessInfo();
observeMenuSections();
