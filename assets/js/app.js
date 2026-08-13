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

function formatCurrency(cents) {
    return currencyFormatter.format(cents / 100);
}

function getScrollBehavior() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

function createProductCard(product, shouldLoadImmediately) {
    const card = document.createElement('article');
    card.className = 'product-card';

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
            productGrid.append(createProductCard(product, shouldLoadImmediately));
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

renderMenu();
renderBusinessInfo();
observeMenuSections();
