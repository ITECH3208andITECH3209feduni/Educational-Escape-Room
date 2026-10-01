// Presentation only: preserve existing inputs, event handlers and room payloads.
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('roomForm');
    const container = document.getElementById('questionsContainer');
    if (!form || !container) return;
    const sections = Array.from(form.querySelectorAll(':scope > .room-form-section'));
    if (sections.length !== 3) return;
    form.classList.add('compact-builder');
    const nav = document.createElement('div');
    nav.className = 'builder-tabs';
    nav.setAttribute('role', 'tablist');
    nav.setAttribute('aria-label', 'Room configuration');
    const titles = ['Room details', 'Questions', 'Settings'];
    const tabs = sections.map((section, index) => {
        section.id = `builder-panel-${index}`;
        section.setAttribute('role', 'tabpanel');
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.id = `builder-tab-${index}`;
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-controls', section.id);
        section.setAttribute('aria-labelledby', tab.id);
        tab.textContent = titles[index];
        tab.addEventListener('click', () => selectTab(index));
        tab.addEventListener('keydown', event => {
            let next;
            if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
            if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
            if (event.key === 'Home') next = 0;
            if (event.key === 'End') next = tabs.length - 1;
            if (next !== undefined) { event.preventDefault(); selectTab(next); tabs[next].focus(); }
        });
        nav.append(tab);
        return tab;
    });
    form.prepend(nav);
    function selectTab(index) {
        sections.forEach((section, i) => { section.hidden = i !== index; });
        tabs.forEach((tab, i) => {
            tab.setAttribute('aria-selected', String(i === index));
            tab.tabIndex = i === index ? 0 : -1;
        });
    }
    const count = document.createElement('p');
    count.className = 'builder-question-count';
    count.setAttribute('aria-live', 'polite');
    container.before(count);
    let serial = 0;
    function openCard(card, open = true) {
        for (const other of container.querySelectorAll('.question-card')) {
            const expanded = other === card && open;
            other.classList.toggle('is-expanded', expanded);
            const grid = other.querySelector('.question-grid');
            const button = other.querySelector('.question-toggle');
            if (grid) grid.hidden = !expanded;
            if (button) button.setAttribute('aria-expanded', String(expanded));
        }
    }
    function updateSummary(card) {
        const text = card.querySelector('.question-text')?.value.trim() || 'New question';
        const type = card.querySelector('.question-type')?.selectedOptions[0]?.textContent.trim() || 'Text Answer';
        const points = card.querySelector('.question-points')?.value || '0';
        const summary = card.querySelector('.question-summary');
        if (summary) summary.textContent = `${text} · ${type} · ${points} points`;
    }
    function enhance(card) {
        if (card.dataset.compactReady) return;
        card.dataset.compactReady = 'true';
        // The original template uses non-breaking-space indentation. Blank
        // text nodes containing it become anonymous CSS grid/flex items.
        const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
        const blanks = [];
        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (!node.textContent.trim() && node.parentElement.tagName !== 'TEXTAREA') blanks.push(node);
        }
        blanks.forEach(node => node.remove());
        const header = card.querySelector('.question-header');
        const heading = header.querySelector('h3');
        const grid = card.querySelector('.question-grid');
        grid.id = `question-editor-${++serial}`;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'question-toggle';
        button.setAttribute('aria-controls', grid.id);
        // Move the original number span, preserving the existing renumbering code.
        while (heading.firstChild) button.append(heading.firstChild);
        const summary = document.createElement('span');
        summary.className = 'question-summary';
        button.append(summary);
        heading.replaceWith(button);
        button.addEventListener('click', () => openCard(card, !card.classList.contains('is-expanded')));
        card.addEventListener('input', () => updateSummary(card));
        card.addEventListener('change', () => updateSummary(card));
        updateSummary(card);
    }
    function refresh() {
        const cards = Array.from(container.querySelectorAll(':scope > .question-card'));
        const added = cards.filter(card => !card.dataset.compactReady);
        added.forEach(enhance);
        if (added.length) {
            openCard(added[added.length - 1]);
            added[added.length - 1].scrollIntoView({ block: 'nearest' });
        } else if (cards.length && !cards.some(card => card.classList.contains('is-expanded'))) {
            openCard(cards[0]);
        }
        count.textContent = cards.length ? `${cards.length} question${cards.length === 1 ? '' : 's'} · Select a question to edit it.` : 'No questions yet. Add your first question.';
        tabs[1].textContent = `Questions (${cards.length})`;
    }
    new MutationObserver(refresh).observe(container, { childList: true });
    // Reveal hidden required inputs before native form validation focuses them.
    let revealingInvalid = false;
    form.addEventListener('invalid', event => {
        if (revealingInvalid) return;
        revealingInvalid = true;
        setTimeout(() => { revealingInvalid = false; }, 0);
        const index = sections.findIndex(section => section.contains(event.target));
        if (index !== -1) selectTab(index);
        const card = event.target.closest('.question-card');
        if (card) openCard(card);
    }, true);
    form.addEventListener('reset', () => selectTab(0));
    document.getElementById('addQuestionBtn')?.addEventListener('click', () => selectTab(1));
    selectTab(0);
    refresh();
});
