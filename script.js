const notesList = document.querySelector('.notes-list');
const newNoteBtn = document.querySelector('.new-note-btn');
const noteTitle = document.querySelector('.note-title');
const noteContent = document.querySelector('.note-content');
const editorPlaceholder = document.querySelector('.editor-placeholder');
const editorContainer = document.querySelector('.editor-container');
const sidebarToggle = document.querySelector('.sidebar-toggle');
const sidebar = document.querySelector('.sidebar');
const overlay = document.querySelector('.overlay');
const notesCount = document.querySelector('.notes-count');
const deleteNoteBtn = document.querySelector('.delete-note-btn');
const themeSwitch = document.querySelector('.theme-switch');
const searchInput = document.querySelector('.search-input');
const wordCount = document.querySelector('.word-count');
const readingTime = document.querySelector('.reading-time');
const exportAllBtn = document.querySelector('.export-all-btn');
const importBtn = document.querySelector('.import-btn');
const importFileInput = document.querySelector('.import-file-input');
const notification = document.querySelector('.notification');
const notificationMessage = document.querySelector('.notification-message');
const exportNoteBtn = document.querySelector('.export-note-btn');
const searchHelpBtn = document.querySelector('.search-help-btn');
const searchHelpTooltip = document.querySelector('.search-help-tooltip');

let notes = JSON.parse(localStorage.getItem('notes')) || [];
let activeNote = null;
let darkMode = localStorage.getItem('darkMode') !== 'false';
let searchTimeout = null;

// Show notification
function showNotification(message, isError = false) {
    notification.classList.remove('error');
    if (isError) {
        notification.classList.add('error');
    }
    notificationMessage.textContent = message;
    notification.classList.add('show');

    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Load notes from local storage
function loadNotes() {
    notesList.innerHTML = '';
    notes.forEach((note, index) => {
        const noteItem = document.createElement('li');
        noteItem.classList.add('note-item');
        noteItem.setAttribute('data-index', index);
        noteItem.innerHTML = `
            <div class="note-item-title">${note.title || 'Untitled'}</div>
            <div class="note-item-preview">${note.content.substring(0, 50)}</div>
            <div class="note-item-footer">
                <span class="timestamp">${new Date(note.timestamp).toLocaleString()}</span>
            </div>
        `;
        noteItem.addEventListener('click', () => loadNote(index));
        notesList.appendChild(noteItem);
    });
    notesCount.textContent = `${notes.length} note${notes.length !== 1 ? 's' : ''}`;
}

// Load a specific note
function loadNote(index) {
    activeNote = index;
    const note = notes[index];

    noteTitle.value = note.title;
    noteContent.value = note.content;
    editorPlaceholder.style.display = 'none';
    editorContainer.style.display = 'flex';
    updateWordCount();
    updateReadingTime();

    // If sidebar is open on mobile, close it
    if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
        toggleSidebar();
    }
}

// Create a new note
function createNote() {
    const timestamp = new Date().toISOString();
    const newNote = {
        title: '',
        content: '',
        timestamp
    };
    notes.push(newNote);
    saveNotes();
    loadNotes();
    resetEditor();
    loadNote(notes.length - 1);
}

// Save notes to local storage
function saveNotes() {
    localStorage.setItem('notes', JSON.stringify(notes));
}

// Update the current note
function updateNote() {
    if (activeNote !== null) {
        notes[activeNote].title = noteTitle.value;
        notes[activeNote].content = noteContent.value;
        notes[activeNote].timestamp = new Date().toISOString();
        saveNotes();
        loadNotes();
    }
}

// Delete the current note
function deleteNote() {
    if (activeNote !== null) {
        const confirmDelete = confirm("Are you sure you want to delete this note?");
        if (confirmDelete) {
            notes.splice(activeNote, 1);
            saveNotes();
            loadNotes();
            resetEditor();
        }
    }
}

// Reset the editor
function resetEditor() {
    noteTitle.value = '';
    noteContent.value = '';
    editorPlaceholder.style.display = 'flex';
    editorContainer.style.display = 'none';
    activeNote = null;
    updateWordCount();
    updateReadingTime();
}

// Update word count
function updateWordCount() {
    const content = noteContent.value;
    const words = content ? content.trim().split(/\s+/).filter(word => word.length > 0) : [];
    wordCount.textContent = `${words.length} words`;
}

// Update reading time
function updateReadingTime() {
    const content = noteContent.value;
    const words = content ? content.trim().split(/\s+/).filter(word => word.length > 0) : [];
    const minutes = Math.ceil(words.length / 200);
    readingTime.textContent = `${minutes} min read`;
}

// Toggle dark mode
function toggleDarkMode() {
    darkMode = !darkMode;
    localStorage.setItem('darkMode', darkMode);
    document.body.classList.toggle('light-mode', !darkMode);
}

// Toggle sidebar
function toggleSidebar() {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

// Export all notes as a JSON file
exportAllBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'notes.json';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    showNotification('All notes exported successfully!');
});

// Export the current note as a text file
exportNoteBtn.addEventListener('click', () => {
    if (activeNote !== null) {
        const note = notes[activeNote];
        const blob = new Blob([note.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${note.title || 'Untitled'}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        showNotification('Note exported successfully!');
    }
});

// Import notes from a JSON file
importBtn.addEventListener('click', () => {
    importFileInput.click();
});

importFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedNotes = JSON.parse(e.target.result);
                if (Array.isArray(importedNotes)) {
                    notes = importedNotes;
                    saveNotes();
                    loadNotes();
                    resetEditor();
                    showNotification('Notes imported successfully!');
                } else {
                    showNotification('Invalid file format.', true);
                }
            } catch (error) {
                showNotification('Failed to import notes.', true);
            }
        };
        reader.readAsText(file);
    }
});

// Render notes based on search input
function renderNotes(filteredNotes) {
    notesList.innerHTML = '';
    const query = searchInput.value.toLowerCase().trim();
    const searchTerms = query ? query.split(/\s+/) : [];

    filteredNotes.forEach((note, i) => {
        // Find the actual index in the original notes array
        const originalIndex = notes.findIndex(n => n === note);

        let title = note.title || 'Untitled';
        let content = note.content.substring(0, 50);

        // Highlight matching terms in title and preview
        if (searchTerms.length > 0) {
            searchTerms.forEach(term => {
                if (!term) return;

                const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                title = title.replace(regex, '<span class="highlight-match">$1</span>');
                content = content.replace(regex, '<span class="highlight-match">$1</span>');
            });
        }

        const noteItem = document.createElement('li');
        noteItem.classList.add('note-item');
        noteItem.setAttribute('data-index', originalIndex);
        noteItem.innerHTML = `
            <div class="note-item-title">${title}</div>
            <div class="note-item-preview">${content}</div>
            <div class="note-item-footer">
                <span class="timestamp">${new Date(note.timestamp).toLocaleString()}</span>
            </div>
        `;
        noteItem.addEventListener('click', () => loadNote(originalIndex));
        notesList.appendChild(noteItem);
    });
}

// Event listeners
newNoteBtn.addEventListener('click', createNote);
noteTitle.addEventListener('input', updateNote);
noteContent.addEventListener('input', () => {
    updateNote();
    updateWordCount();
    updateReadingTime();
});
deleteNoteBtn.addEventListener('click', deleteNote);
themeSwitch.addEventListener('click', toggleDarkMode);
sidebarToggle.addEventListener('click', toggleSidebar);
overlay.addEventListener('click', toggleSidebar);
searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const query = searchInput.value.trim();

        if (!query) {
            renderNotes(notes);
            notesCount.textContent = `${notes.length} note${notes.length !== 1 ? 's' : ''}`;
            return;
        }

        // Parse the search query into tokens
        const tokens = parseSearchQuery(query);

        // Filter notes based on the tokens
        const searchResults = performTokenSearch(notes, tokens);

        // Render the filtered notes
        renderNotes(searchResults.map(result => result.note));

        // Update the notes count with search results
        notesCount.textContent = `${searchResults.length} of ${notes.length} notes`;
    }, 300);
});

// Initialize the search help tooltip
searchInput.setAttribute('placeholder', 'Search notes... (try "quotes" or +required)');

// Optional: Add click functionality instead of hover
searchHelpBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    searchHelpTooltip.classList.toggle('active');
});

// Close tooltip when clicking elsewhere
document.addEventListener('click', () => {
    searchHelpTooltip.classList.remove('active');
});

/**
 * Parse a search query into tokens with operators
 * Supports:
 * - Quoted phrases: "exact match"
 * - Regular terms
 */
function parseSearchQuery(query) {
    const tokens = [];
    let current = '';
    let inQuotes = false;

    // Helper to add current token to the tokens array
    const addToken = (str, type = 'normal') => {
        if (str) tokens.push({ text: str.toLowerCase(), type });
    };

    // Parse the query character by character
    for (let i = 0; i < query.length; i++) {
        const char = query[i];

        if (char === '"') {
            if (inQuotes) {
                // End of a quoted phrase
                addToken(current, 'phrase');
                current = '';
                inQuotes = false;
            } else {
                // Start of a quoted phrase
                if (current) addToken(current);
                current = '';
                inQuotes = true;
            }
        } else if (!inQuotes && (char === ' ' || char === '\t')) {
            // Space outside quotes means end of current token
            addToken(current);
            current = '';
        } else {
            // Add character to current token
            current += char;
        }
    }

    // Add the last token if there is one
    if (current) {
        if (inQuotes) {
            addToken(current, 'phrase');
        } else {
            addToken(current);
        }
    }

    // Process operators
    return tokens.map(token => {
        if (token.text.startsWith('+')) {
            return { text: token.text.substring(1), type: 'required' };
        } else if (token.text.startsWith('-')) {
            return { text: token.text.substring(1), type: 'excluded' };
        }
        return token;
    }).filter(token => token.text); // Remove empty tokens
}

/**
 * Perform token-based search on notes
 */
function performTokenSearch(notes, tokens) {
    if (!tokens.length) return [];

    return notes
        .map(note => {
            const titleText = note.title.toLowerCase();
            const contentText = note.content.toLowerCase();
            let score = 0;
            let isMatch = true;

            // Check each token against the note
            tokens.forEach(token => {
                let tokenMatch = false;

                if (token.type === 'phrase') {
                    // Exact phrase matching
                    if (titleText.includes(token.text)) {
                        score += 15;
                        tokenMatch = true;
                    }
                    if (contentText.includes(token.text)) {
                        score += 10;
                        tokenMatch = true;
                    }
                } else {
                    // Word boundary check for more precise matching
                    const titleMatches = findWordMatches(titleText, token.text);
                    const contentMatches = findWordMatches(contentText, token.text);

                    if (titleMatches.length > 0) {
                        // Title matches are weighted higher
                        score += titleMatches.reduce((sum, match) => sum + calculateMatchScore(match, true), 0);
                        tokenMatch = true;
                    }

                    if (contentMatches.length > 0) {
                        score += contentMatches.reduce((sum, match) => sum + calculateMatchScore(match, false), 0);
                        tokenMatch = true;
                    }
                }

                // Handle required and excluded tokens
                if (token.type === 'required' && !tokenMatch) {
                    isMatch = false;
                } else if (token.type === 'excluded' && tokenMatch) {
                    isMatch = false;
                }
            });

            return {
                note,
                score,
                isMatch
            };
        })
        .filter(result => result.isMatch)
        .sort((a, b) => b.score - a.score);
}

/**
 * Find all occurrences of a term in text with word boundary awareness
 */
function findWordMatches(text, term) {
    const matches = [];
    const words = text.split(/\b/);
    let index = 0;

    for (let i = 0; i < words.length; i++) {
        const word = words[i].trim();
        if (!word) {
            index += words[i].length;
            continue;
        }

        if (word === term) {
            // Exact match
            matches.push({
                word,
                index,
                type: 'exact'
            });
        } else if (word.startsWith(term)) {
            // Prefix match
            matches.push({
                word,
                index,
                type: 'prefix'
            });
        } else if (word.includes(term)) {
            // Substring match
            matches.push({
                word,
                index,
                type: 'substring'
            });
        }

        index += words[i].length;
    }

    return matches;
}

/**
 * Calculate the score for a match based on match type and location
 */
function calculateMatchScore(match, isTitle) {
    // Base scores
    const locationMultiplier = isTitle ? 2 : 1;

    // Score based on match type
    switch (match.type) {
        case 'exact':
            return 10 * locationMultiplier;
        case 'prefix':
            return 5 * locationMultiplier;
        case 'substring':
            return 2 * locationMultiplier;
        default:
            return 1 * locationMultiplier;
    }
}

/**
 * Highlight search matches in rendered notes
 * Update this function to highlight matches more precisely
 */
function highlightMatches(text, tokens) {
    if (!tokens || !tokens.length) return text;

    let highlighted = text;

    // Sort tokens by length (descending) to prevent nested highlights
    const sortedTokens = [...tokens].sort((a, b) => b.text.length - a.text.length);

    sortedTokens.forEach(token => {
        // Skip excluded tokens for highlighting
        if (token.type === 'excluded') return;

        const regex = new RegExp(
            token.type === 'phrase'
                ? `(${escapeRegExp(token.text)})`
                : `\\b(${escapeRegExp(token.text)})\\w*\\b`,
            'gi'
        );

        highlighted = highlighted.replace(regex, '<span class="highlight-match">$1</span>');
    });

    return highlighted;
}

// Helper to escape special characters in regular expressions
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Update the renderNotes function to use the new highlighting
function renderNotes(filteredNotes) {
    notesList.innerHTML = '';
    const query = searchInput.value.trim();
    const tokens = query ? parseSearchQuery(query) : [];

    filteredNotes.forEach((note, i) => {
        // Find the actual index in the original notes array
        const originalIndex = notes.findIndex(n => n === note);

        let title = note.title || 'Untitled';
        let content = note.content.substring(0, 50);

        // Highlight matching terms in title and preview
        if (tokens.length > 0) {
            title = highlightMatches(title, tokens);
            content = highlightMatches(content, tokens);
        }

        const noteItem = document.createElement('li');
        noteItem.classList.add('note-item');
        noteItem.setAttribute('data-index', originalIndex);
        noteItem.innerHTML = `
            <div class="note-item-title">${title}</div>
            <div class="note-item-preview">${content}</div>
            <div class="note-item-footer">
                <span class="timestamp">${new Date(note.timestamp).toLocaleString()}</span>
            </div>
        `;
        noteItem.addEventListener('click', () => loadNote(originalIndex));
        notesList.appendChild(noteItem);
    });
}

// Initial load
loadNotes();
if (!darkMode) {
    document.body.classList.add('light-mode');
}

// Syntax highlighting
Prism.highlightAll();

// Add auto-save functionality
let autoSaveTimer;
noteContent.addEventListener('input', () => {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        if (activeNote !== null) {
            const saveIndicator = document.createElement('div');
            saveIndicator.className = 'save-indicator';
            saveIndicator.textContent = 'Saved';
            saveIndicator.style.position = 'fixed';
            saveIndicator.style.bottom = '20px';
            saveIndicator.style.right = '20px';
            saveIndicator.style.background = 'var(--accent-color)';
            saveIndicator.style.color = 'white';
            saveIndicator.style.padding = '12px 20px';
            saveIndicator.style.borderRadius = '10px';
            saveIndicator.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
            saveIndicator.style.opacity = '0';
            saveIndicator.style.transition = 'opacity 0.3s, transform 0.3s';
            saveIndicator.style.transform = 'translateY(20px)';

            document.body.appendChild(saveIndicator);
            setTimeout(() => {
                saveIndicator.style.opacity = '1';
                saveIndicator.style.transform = 'translateY(0)';
            }, 10);

            setTimeout(() => {
                saveIndicator.style.opacity = '0';
                saveIndicator.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    document.body.removeChild(saveIndicator);
                }, 300);
            }, 2000);
        }
    }, 1000);
});
