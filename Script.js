
document.addEventListener('DOMContentLoaded', function() {
    const entryForm = document.getElementById('entry-form');
    const editForm = document.getElementById('edit-form');
    const entriesList = document.getElementById('entries-list');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const editModal = document.getElementById('edit-modal');
    const editModalClose = document.getElementById('edit-modal-close');
    const deleteBtn = document.getElementById('delete-btn');

    document.getElementById('entry-date').valueAsDate = new Date();

    let entries = JSON.parse(localStorage.getItem('dailyWorkEntries')) || [];

    renderEntries(entries);

    entryForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const entry = {
            id: Date.now(),
            date: document.getElementById('entry-date').value,
            title: document.getElementById('entry-title').value,
            description: document.getElementById('entry-description').value
        };
        entries.unshift(entry);
        saveEntries();
        renderEntries(entries);
        entryForm.reset();
        document.getElementById('entry-date').valueAsDate = new Date();
    });

    searchBtn.addEventListener('click', function() {
        const searchTerm = searchInput.value.toLowerCase();
        if (searchTerm === '') {
            renderEntries(entries);
            return;
        }
        const filteredEntries = entries.filter(entry => 
            entry.title.toLowerCase().includes(searchTerm) || 
            entry.description.toLowerCase().includes(searchTerm) ||
            entry.date.includes(searchTerm)
        );
        renderEntries(filteredEntries);
    });

    searchInput.addEventListener('input', function() {
        if (this.value === '') {
            renderEntries(entries);
        }
    });

    editModalClose.addEventListener('click', function() {
        editModal.classList.remove('active');
    });

    deleteBtn.addEventListener('click', function() {
        const id = parseInt(document.getElementById('edit-id').value);
        entries = entries.filter(entry => entry.id !== id);
        saveEntries();
        renderEntries(entries);
        editModal.classList.remove('active');
    });

    editForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const id = parseInt(document.getElementById('edit-id').value);
        const updatedEntry = {
            id: id,
            date: document.getElementById('edit-date').value,
            title: document.getElementById('edit-title').value,
            description: document.getElementById('edit-description').value
        };
        const index = entries.findIndex(entry => entry.id === id);
        if (index !== -1) {
            entries[index] = updatedEntry;
            saveEntries();
            renderEntries(entries);
            editModal.classList.remove('active');
        }
    });

    function renderEntries(entriesToRender) {
        entriesList.innerHTML = '';
        if (entriesToRender.length === 0) {
            entriesList.innerHTML = '<div class="no-entries">No entries found. Add your first work entry!</div>';
            return;
        }
        entriesToRender.sort((a, b) => new Date(b.date) - new Date(a.date));
        entriesToRender.forEach(entry => {
            const entryEl = document.createElement('div');
            entryEl.className = 'entry-card';
            const formattedDate = new Date(entry.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                weekday: 'short'
            });
            entryEl.innerHTML = `
                <div class="entry-header">
                    <span class="entry-date">${formattedDate}</span>
                    <div class="entry-actions">
                        <button class="btn btn-info edit-btn" data-id="${entry.id}">Edit</button>
                    </div>
                </div>
                <h3 class="entry-title">${entry.title}</h3>
                <div class="entry-content">${entry.description}</div>
            `;
            entriesList.appendChild(entryEl);
        });
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = parseInt(this.getAttribute('data-id'));
                openEditModal(id);
            });
        });
    }

    function openEditModal(id) {
        const entry = entries.find(entry => entry.id === id);
        if (entry) {
            document.getElementById('edit-id').value = entry.id;
            document.getElementById('edit-date').value = entry.date;
            document.getElementById('edit-title').value = entry.title;
            document.getElementById('edit-description').value = entry.description;
            editModal.classList.add('active');
        }
    }

    function saveEntries() {
        localStorage.setItem('dailyWorkEntries', JSON.stringify(entries));
    }
});
