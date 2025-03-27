// --- DOM Elements ---
const notesListEl = document.querySelector('.notes-list');
const newNoteBtn = document.querySelector('.new-note-btn');
const noteTitleInput = document.querySelector('.note-title');
const noteBodyEditable = document.querySelector('.note-body');
const editorPlaceholder = document.querySelector('.editor-placeholder');
const editorWrapper = document.querySelector('.editor-wrapper');
const sidebarToggle = document.querySelector('.sidebar-toggle');
const sidebar = document.querySelector('.sidebar');
const overlay = document.querySelector('.overlay');
const notesCountEl = document.querySelector('.notes-count');
const deleteNoteBtn = document.querySelector('.delete-note-btn');
const themeSwitchBtn = document.querySelector('.titlebar-theme-btn');
const searchInput = document.querySelector('.search-input');
const wordCountEl = document.querySelector('.word-count');
const charCountEl = document.querySelector('.char-count');
const readingTimeEl = document.querySelector('.reading-time');
const exportAllBtn = document.querySelector('.export-all-btn');
const importBtn = document.querySelector('.import-btn');
const importFileInput = document.querySelector('.import-file-input');
const notification = document.querySelector('.notification');
const notificationMessage = document.querySelector('.notification-message');
const notificationIcon = document.querySelector('.notification-icon i');
const exportNoteBtn = document.querySelector('.export-note-btn');
const searchHelpBtn = document.querySelector('.search-help-btn');
const searchHelpTooltip = document.querySelector('.search-help-tooltip');
const resizeHandle = document.querySelector('.resize-handle');
const lastModifiedEl = document.querySelector('.last-modified');
const editorToolbar = document.querySelector('.editor-toolbar');

// --- Main Area View Elements ---
const mainArea = document.querySelector('.main-area');
const searchResultsView = document.querySelector('.search-results-view');
const searchResultsHeaderQuery = document.querySelector('.search-query-display');
const searchResultsListContainer = document.querySelector('.search-results-list-container');
const searchNoResultsMsg = document.querySelector('.search-no-results');


// --- State Variables ---
let notes = [];
let activeNoteIndex = null;
let darkMode = localStorage.getItem('darkMode') !== 'false';
let searchTimeout = null;
let autoSaveTimeout = null;
let isResizing = false;
let mainViewCurrentState = 'placeholder'; // 'placeholder', 'editor', 'search'

// --- Constants ---
const AUTO_SAVE_DELAY = 1500; // ms
const WORDS_PER_MINUTE = 200;

// --- Initialization ---
function initializeApp() {
    loadNotesFromStorage();
    applyTheme();
    loadSidebarWidth();
    renderNotesList();
    // Set initial main view state
    setMainViewState('placeholder');
    addEventListeners();
    // Optional: Load first note if available
    // if (notes.length > 0) loadNote(0);
}

// --- Main View State Management (REVISED) ---
function setMainViewState(state) { // 'editor', 'placeholder', 'search'
    mainViewCurrentState = state;

    // console.log("Setting Main View State:", state); // Debugging

    // Hide all views first
    editorPlaceholder.style.display = 'none';
    editorWrapper.style.display = 'none';
    searchResultsView.style.display = 'none';

    // Show the requested view
    switch (state) {
        case 'search':
            searchResultsView.style.display = 'flex'; // Use flex for internal layout
            break;
        case 'editor':
            // Ensure we only show editor if a note is actually active
            if (activeNoteIndex !== null && activeNoteIndex < notes.length) {
                editorWrapper.style.display = 'flex'; // Use flex for internal layout
            } else {
                 console.warn("Tried to set state to 'editor' but no active note.");
                 editorPlaceholder.style.display = 'flex'; // Fallback to placeholder
                 mainViewCurrentState = 'placeholder'; // Correct the state variable
            }
            break;
        case 'placeholder':
        default:
            editorPlaceholder.style.display = 'flex';
            break;
    }
}


// --- Core Note Functions ---
function loadNotesFromStorage() {
    try {
        notes = JSON.parse(localStorage.getItem('notes')) || [];
        // Ensure notes have required properties
        notes.forEach(note => {
            if (!note.id) note.id = Date.now().toString() + Math.random().toString(16).substring(2);
            if (!note.timestamp) note.timestamp = new Date().toISOString();
            if (typeof note.title !== 'string') note.title = '';
            if (typeof note.content !== 'string') note.content = '';
        });
        notes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
        console.error("Failed to load notes from storage:", error);
        notes = [];
        localStorage.removeItem('notes');
        showNotification("Error loading notes. Storage might be corrupted.", true);
    }
}

function saveNotesToStorage() {
     try {
        localStorage.setItem('notes', JSON.stringify(notes));
    } catch (error) {
         console.error("Failed to save notes:", error);
         showNotification("Error saving notes. Changes might be lost.", true);
    }
}

function createNote() {
    if (activeNoteIndex !== null) {
        updateNote();
    }

    const timestamp = new Date().toISOString();
    const newNote = {
        id: Date.now().toString() + Math.random().toString(16).substring(2),
        title: '',
        content: '',
        timestamp
    };
    notes.unshift(newNote);
    saveNotesToStorage();
    renderNotesList();

    // If search is active, clear input but let loadNote handle view state
    if (mainViewCurrentState === 'search') {
        searchInput.value = '';
    }

    loadNote(0);
    noteTitleInput.focus();
}

function loadNote(index) {
    if (index < 0 || index >= notes.length) {
        console.warn(`Attempted to load invalid note index: ${index}`);
        resetEditor();
        return;
    }

    if (activeNoteIndex !== null && activeNoteIndex !== index) {
         clearTimeout(autoSaveTimeout);
         updateNote();
    }

    activeNoteIndex = index;
    const note = notes[index];

    noteTitleInput.value = note.title;
    noteBodyEditable.innerHTML = note.content;

    setMainViewState('editor'); // Use state function

    updateStatusBar();
    updateLastModified(note.timestamp);
    highlightActiveNoteItem();
    updateToolbarStates();

    if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
        toggleSidebar();
    }
}

function updateNote() {
    if (activeNoteIndex === null || activeNoteIndex >= notes.length) return;

    const currentNote = notes[activeNoteIndex];
    const newTitle = noteTitleInput.value;
    const newContent = noteBodyEditable.innerHTML;

    if (currentNote.title !== newTitle || currentNote.content !== newContent) {
        currentNote.title = newTitle;
        currentNote.content = newContent;
        currentNote.timestamp = new Date().toISOString();

        if (activeNoteIndex !== 0) {
             notes.splice(activeNoteIndex, 1);
             notes.unshift(currentNote);
             activeNoteIndex = 0;
             renderNotesList(); // Re-render immediately after structure change
        } else {
             saveNotesToStorage(); // Save changes even if position doesn't change
             renderNotesList(); // Re-render to update timestamp in list
        }

        saveNotesToStorage();
        updateLastModified(currentNote.timestamp);
    }
}

function deleteNote() {
    if (activeNoteIndex === null || activeNoteIndex >= notes.length) return;

    const noteTitle = notes[activeNoteIndex].title || 'Untitled';
    if (confirm(`Are you sure you want to delete "${noteTitle}"?`)) {
        const deletedNoteId = notes[activeNoteIndex].id;
        notes.splice(activeNoteIndex, 1);
        saveNotesToStorage();
        const wasSearching = (mainViewCurrentState === 'search'); // Check state before resetting index
        const prevActiveIndex = activeNoteIndex;
        activeNoteIndex = null;

        if (wasSearching) {
             // Re-run search logic: updates sidebar list, main results view, and keeps state as 'search'
             handleSearchInput(); // This will re-render both lists and set state
        } else {
             // If not searching, reset editor (goes to placeholder) and update sidebar list
             renderNotesList(); // Update sidebar
             resetEditor(); // Sets state to 'placeholder'
        }

        showNotification(`Note "${noteTitle}" deleted.`);
    }
}


function resetEditor() {
    noteTitleInput.value = '';
    noteBodyEditable.innerHTML = '';
    activeNoteIndex = null;

    setMainViewState('placeholder'); // Use state function

    updateStatusBar();
    updateLastModified(null);
    highlightActiveNoteItem();
    updateToolbarStates();
}

// --- UI Rendering & Updates ---
function renderNotesList(notesToRender = notes) {
    // console.log("Rendering sidebar list with", notesToRender.length, "notes");
    notesListEl.innerHTML = '';
    notesToRender.forEach((note) => {
        const originalIndex = notes.findIndex(n => n.id === note.id);
        if (originalIndex === -1) return;

        const noteItem = document.createElement('li');
        noteItem.classList.add('note-item');
        noteItem.setAttribute('data-index', originalIndex);

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = note.content;
        const previewText = tempDiv.textContent || tempDiv.innerText || '';

        let title = note.title || 'Untitled';
        let preview = previewText.substring(0, 100);

        const query = searchInput.value.trim();
        if (query) {
            const terms = query.match(/([+-]?"[^"]+")|([+-]?[\w'-]+)/g) || [];
            terms.forEach(term => {
                const cleanTerm = term.replace(/^["+-\s]+|["\s]+$/g, '');
                 if (!cleanTerm || term.startsWith('-')) return;
                try {
                    const regex = new RegExp(`(${escapeRegExp(cleanTerm)})`, 'gi');
                    title = title.replace(regex, '<span class="highlight-match">$1</span>');
                     if (!preview.includes('<') && !preview.includes('>')) {
                         preview = preview.replace(regex, '<span class="highlight-match">$1</span>');
                     }
                } catch (e) { console.error("Regex error:", e); }
            });
        }

        noteItem.innerHTML = `
            <div class="note-item-title">${title}</div>
            <div class="note-item-preview">${preview || '<span style="color: var(--text-tertiary);">Empty Note</span>'}</div>
            <div class="timestamp">${formatTimestamp(note.timestamp)}</div>
        `;
        noteItem.addEventListener('click', () => {
            if (originalIndex === activeNoteIndex) return;
            clearTimeout(autoSaveTimeout);
            updateNote();
            loadNote(originalIndex);
        });

        // No need to add 'active' class here, highlightActiveNoteItem handles it
        notesListEl.appendChild(noteItem);
    });
    updateNotesCount(notesToRender.length, notes.length);
    highlightActiveNoteItem(); // Ensure highlight is correct after full render
}

function highlightActiveNoteItem() {
    // Separate function to ensure only one item is active
    document.querySelectorAll('.note-item').forEach(item => {
        const itemIndex = parseInt(item.getAttribute('data-index'), 10);
        item.classList.toggle('active', itemIndex === activeNoteIndex);
    });
}

function updateNotesCount(shownCount, totalCount) {
    if (searchInput.value.trim() === '' || shownCount === totalCount) {
        notesCountEl.textContent = `${totalCount} note${totalCount !== 1 ? 's' : ''}`;
    } else {
        notesCountEl.textContent = `Found ${shownCount} of ${totalCount}`;
    }
}

function updateStatusBar() {
    requestAnimationFrame(() => {
         if (mainViewCurrentState !== 'editor') {
             wordCountEl.innerHTML = `<i class="fas fa-text-width"></i> 0 words`;
             charCountEl.innerHTML = `<i class="fas fa-pen-nib"></i> 0 characters`;
             readingTimeEl.innerHTML = `<i class="fas fa-clock"></i> 0 min read`;
             return;
         }
         const content = noteBodyEditable.innerText || '';
         const words = content.trim().split(/\s+/).filter(Boolean);
         const wordCount = words.length;
         const charCount = content.length;
         const minutes = wordCount === 0 ? 0 : Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));

         wordCountEl.innerHTML = `<i class="fas fa-text-width"></i> ${wordCount} words`;
         charCountEl.innerHTML = `<i class="fas fa-pen-nib"></i> ${charCount} characters`;
         readingTimeEl.innerHTML = `<i class="fas fa-clock"></i> ${minutes} min read`;
    });
}

function updateLastModified(timestamp) {
    lastModifiedEl.textContent = timestamp ? `Modified: ${formatTimestamp(timestamp, true)}` : '';
}

function formatTimestamp(isoString, includeTime = false) {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return "Invalid Date";

        const optionsDate = { year: 'numeric', month: 'short', day: 'numeric' };
        const optionsTime = { hour: '2-digit', minute: '2-digit' };

        if (includeTime) {
            return `${date.toLocaleDateString(undefined, optionsDate)}, ${date.toLocaleTimeString(undefined, optionsTime)}`;
        } else {
             const today = new Date();
             const yesterday = new Date(today);
             yesterday.setDate(today.getDate() - 1);

             const isToday = date.toDateString() === today.toDateString();
             const isYesterday = date.toDateString() === yesterday.toDateString();

             if (isToday) return date.toLocaleTimeString(undefined, optionsTime);
             if (isYesterday) return `Yesterday`;
             return date.toLocaleDateString(undefined, optionsDate);
        }
    } catch (error) {
         console.error("Error formatting timestamp:", isoString, error);
         return "Invalid Date";
    }
}

// --- Theme ---
function applyTheme() {
    document.body.classList.toggle('light-mode', !darkMode);
    themeSwitchBtn.innerHTML = darkMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    themeSwitchBtn.title = darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode';
}

function toggleTheme() {
    darkMode = !darkMode;
    localStorage.setItem('darkMode', darkMode);
    applyTheme();
}

// --- Sidebar ---
function toggleSidebar() {
    sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
}

function loadSidebarWidth() {
    if (window.innerWidth > 768) {
        const savedWidth = localStorage.getItem('sidebarWidth');
        if (savedWidth) {
            try {
                 const numericWidth = parseInt(savedWidth, 10);
                 const minW = parseInt(getComputedStyle(sidebar).minWidth, 10) || 220;
                 const maxW = parseInt(getComputedStyle(sidebar).maxWidth, 10) || 600;
                 if (!isNaN(numericWidth) && numericWidth > 0) {
                      sidebar.style.width = `${Math.max(minW, Math.min(numericWidth, maxW))}px`;
                 } else { sidebar.style.width = ''; }
            } catch (e) { console.error("Error applying sidebar width:", e); sidebar.style.width = ''; }
        } else { sidebar.style.width = ''; }
    } else { sidebar.style.width = ''; }
}

function startResize(e) {
    if (e.button !== 0) return;
    isResizing = true;
    resizeHandle.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize, { once: true });
}

function handleResize(e) {
    if (!isResizing) return;
    requestAnimationFrame(() => {
        const sidebarRect = sidebar.getBoundingClientRect();
        let newWidth = e.clientX - sidebarRect.left;
        const minW = parseInt(getComputedStyle(sidebar).minWidth, 10) || 220;
        const maxW = parseInt(getComputedStyle(sidebar).maxWidth, 10) || 600;
        newWidth = Math.max(minW, Math.min(newWidth, maxW));
        sidebar.style.width = `${newWidth}px`;
    });
}

function stopResize() {
    if (isResizing) {
        isResizing = false;
        resizeHandle.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', handleResize);
        const finalWidth = sidebar.offsetWidth;
        if (finalWidth > 0) localStorage.setItem('sidebarWidth', finalWidth);
    }
}

// --- Search ---
function handleSearchInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const query = searchInput.value.trim();

        if (!query) {
            renderNotesList(notes);
            if (activeNoteIndex !== null) setMainViewState('editor');
            else setMainViewState('placeholder');
            return;
        }

        const searchResults = performSearch(query);
        renderNotesList(searchResults); // Update sidebar
        renderSearchResultsInMainView(searchResults, query); // Update main view results
        setMainViewState('search'); // Set main view state

    }, 300);
}


function performSearch(query) {
     const tokens = parseSearchQuery(query);
    if (!tokens.length) return notes;

    return notes.map(note => {
            const titleText = note.title.toLowerCase();
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = note.content;
            const contentText = (tempDiv.textContent || tempDiv.innerText || '').toLowerCase();

            let score = 0;
            let meetsRequirements = true;
            let matchedPositive = false;

            tokens.forEach(token => {
                let found = false;
                const searchTerm = token.text;
                const isExcluded = token.type === 'excluded';

                if (!searchTerm) return;

                 try {
                     const regex = new RegExp(
                         token.type === 'phrase' ? escapeRegExp(searchTerm) : `\\b${escapeRegExp(searchTerm)}`,
                         'gi'
                     );
                     if (titleText.match(regex)) { score += (isExcluded ? 0 : 10); found = true; }
                     if (contentText.match(regex)) { score += (isExcluded ? 0 : 5); found = true; }
                 } catch(e) { console.error("Regex error in search:", e); }

                if (token.type === 'required' && !found) meetsRequirements = false;
                if (isExcluded && found) meetsRequirements = false;
                if (!isExcluded && found) matchedPositive = true;
            });

            const hasPositiveTokens = tokens.some(t => t.type !== 'excluded');
            if (!meetsRequirements || (hasPositiveTokens && !matchedPositive)) return null;

            return { note, score };
        })
        .filter(result => result !== null)
        .sort((a, b) => b.score - a.score)
        .map(result => result.note);
}

function parseSearchQuery(query) {
    const tokens = [];
    const regex = /([+-]?"[^"]+")|([+-]?[\w'-]+)/g;
    let match;
    while ((match = regex.exec(query)) !== null) {
        let term = match[0];
        let type = 'normal';
        let text = term;

        if (term.startsWith('+')) { type = 'required'; text = term.substring(1); }
        else if (term.startsWith('-')) { type = 'excluded'; text = term.substring(1); }

        if (text.startsWith('"') && text.endsWith('"')) {
            type = (type === 'required' || type === 'excluded') ? type : 'phrase';
            text = text.substring(1, text.length - 1);
        }
        text = text.trim();
        if (text) tokens.push({ text: text.toLowerCase(), type });
    }
    return tokens;
}


function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- Render Search Results in Main View ---
function renderSearchResultsInMainView(results, query) {
    searchResultsHeaderQuery.textContent = query;
    searchResultsListContainer.innerHTML = ''; // Clear previous results

    if (results.length === 0) {
        searchNoResultsMsg.style.display = 'block';
        searchResultsListContainer.style.display = 'none'; // Hide the container itself
    } else {
        searchNoResultsMsg.style.display = 'none';
        searchResultsListContainer.style.display = 'block'; // Show the container

        results.forEach(note => {
            const originalIndex = notes.findIndex(n => n.id === note.id);
            if (originalIndex === -1) return;

            const item = document.createElement('div');
            item.classList.add('search-result-item');
            item.setAttribute('data-index', originalIndex);

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = note.content;
            const contentText = tempDiv.textContent || tempDiv.innerText || '';

            let snippetHTML = contentText.substring(0, 250); // Default snippet

             const terms = parseSearchQuery(query);
             const positiveTerms = terms.filter(t => t.type !== 'excluded' && t.text);

             let firstMatchIndex = -1;
             if (positiveTerms.length > 0) {
                  for (const term of positiveTerms) {
                       try {
                            const regex = new RegExp(term.type === 'phrase' ? escapeRegExp(term.text) : `\\b${escapeRegExp(term.text)}`, 'i');
                            const match = contentText.match(regex);
                            if (match && match.index !== undefined) { firstMatchIndex = match.index; break; }
                       } catch (e) {}
                  }
             }

             if (firstMatchIndex !== -1) {
                  const start = Math.max(0, firstMatchIndex - 80);
                  const end = Math.min(contentText.length, firstMatchIndex + 170);
                  snippetHTML = (start > 0 ? '... ' : '') + contentText.substring(start, end) + (end < contentText.length ? ' ...' : '');
             }

            let title = note.title || 'Untitled';

            // Apply highlighting
             positiveTerms.forEach(term => {
                 try {
                     const regex = new RegExp(escapeRegExp(term.text), 'gi');
                     const replacer = (match) => `<span class="highlight-match">${match}</span>`;
                     if (!title.includes('highlight-match')) title = title.replace(regex, replacer);
                     snippetHTML = snippetHTML.replace(regex, replacer);
                 } catch (e) { console.error("Regex error during highlight:", e); }
             });

            item.innerHTML = `
                <div class="search-result-note-title">${title}</div>
                <div class="search-result-snippet">${snippetHTML || '<span style="color: var(--text-tertiary);">Empty Note</span>'}</div>
            `;

            item.addEventListener('click', () => {
                clearTimeout(autoSaveTimeout);
                loadNote(originalIndex);
                // Optional: Clear search on click
                // searchInput.value = '';
                // handleSearchInput();
            });
            searchResultsListContainer.appendChild(item);
        });
    }
}


// --- Import/Export --- (Functions remain the same as previous version)
function exportAllNotes() {
     if (notes.length === 0) { showNotification("No notes to export.", true); return; }
    try {
        const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `notes_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url); showNotification('All notes exported successfully!');
    } catch (error) { console.error("Export failed:", error); showNotification('Failed to export notes.', true); }
}
function triggerImport() { importFileInput.click(); }
function importNotes(event) {
     const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            let notesToImport = [];
            if (Array.isArray(importedData)) notesToImport = importedData;
            else if (importedData && Array.isArray(importedData.notes)) notesToImport = importedData.notes;
            else throw new Error("Invalid format: Expected an array of notes.");

            const validNotes = notesToImport.filter(note => note && typeof note.content === 'string' && note.timestamp && (!note.id || typeof note.id === 'string'))
                .map(note => ({ id: note.id || Date.now().toString() + Math.random().toString(16).substring(2), title: typeof note.title === 'string' ? note.title : '', content: note.content, timestamp: note.timestamp }));
            const invalidCount = notesToImport.length - validNotes.length;
            if (validNotes.length === 0) { if (notesToImport.length > 0) throw new Error("No valid notes found in the file."); else { showNotification("Selected file contains no notes.", true); return; }}

            const existingIds = new Set(notes.map(n => n.id));
            const newNotes = validNotes.filter(n => !existingIds.has(n.id));
            const updatedNotesCount = validNotes.length - newNotes.length;
            notes = [...newNotes, ...notes]; notes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            saveNotesToStorage();
            if (mainViewCurrentState === 'search') searchInput.value = '';
            renderNotesList(); resetEditor();
            let message = `${newNotes.length} new note(s) imported.`;
            if (updatedNotesCount > 0) message += ` ${updatedNotesCount} existing notes skipped.`;
            if (invalidCount > 0) message += ` ${invalidCount} invalid items ignored.`;
            showNotification(message);
        } catch (error) { console.error("Import failed:", error); showNotification(`Import failed: ${error.message}`, true); }
        finally { importFileInput.value = ''; }
    };
    reader.onerror = () => { showNotification('Error reading file.', true); importFileInput.value = ''; };
    reader.readAsText(file);
}
function exportCurrentNote() {
     if (mainViewCurrentState !== 'editor' || activeNoteIndex === null) { showNotification("No active note selected to export.", true); return; }
    const note = notes[activeNoteIndex]; const title = note.title || 'Untitled';
    try {
        const tempDiv = document.createElement('div'); tempDiv.innerHTML = note.content; const textContent = tempDiv.textContent || tempDiv.innerText || '';
        const blob = new Blob([`Title: ${note.title}\n\n---\n\n${textContent}`], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
        a.download = `${title.replace(/[^a-z0-9 _-]/gi, '_')}.txt`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url); showNotification(`Note "${title}" exported as text.`);
    } catch (error) { console.error("Export current note failed:", error); showNotification('Failed to export current note.', true); }
}

// --- Notifications ---
function showNotification(message, isError = false) {
     notificationMessage.textContent = message;
    notificationIcon.className = isError ? 'fas fa-exclamation-circle error-icon' : 'fas fa-check-circle success-icon';
    notification.classList.toggle('error', isError);
    clearTimeout(notification.timerId);
    notification.classList.remove('show'); void notification.offsetWidth;
    notification.classList.add('show');
    notification.timerId = setTimeout(() => notification.classList.remove('show'), 3500);
}

// --- Rich Text Editing ---
function handleToolbarClick(e) {
     let target = e.target;
    while (target && target !== editorToolbar && !target.classList.contains('toolbar-btn')) target = target.parentElement;

    if (mainViewCurrentState === 'editor') {
        if (!noteBodyEditable.contains(document.activeElement)) {
             noteBodyEditable.focus();
             setTimeout(() => executeFormatCommand(target), 50);
        } else {
             executeFormatCommand(target);
        }
    }
}

function executeFormatCommand(target) {
     if (target && target.classList.contains('format-btn')) {
        const command = target.dataset.command;
        const value = target.dataset.value || null;
        if (command) {
            document.execCommand(command, false, value);
            handleEditorInput(); updateToolbarStates();
        }
    }
}

// --- Event Listeners ---
function addEventListeners() {
    newNoteBtn.addEventListener('click', createNote);
    noteTitleInput.addEventListener('input', startAutoSaveTimer);
    noteBodyEditable.addEventListener('input', handleEditorInput);
    deleteNoteBtn.addEventListener('click', deleteNote);
    themeSwitchBtn.addEventListener('click', toggleTheme);
    if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
    if (overlay) overlay.addEventListener('click', toggleSidebar);
    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('search', () => { if (!searchInput.value) handleSearchInput(); });
    exportAllBtn.addEventListener('click', exportAllNotes);
    importBtn.addEventListener('click', triggerImport);
    importFileInput.addEventListener('change', importNotes);
    exportNoteBtn.addEventListener('click', exportCurrentNote);
    if (resizeHandle) resizeHandle.addEventListener('mousedown', startResize);
    else console.warn("Resize handle not found. Resizing disabled.");
    editorToolbar.addEventListener('click', handleToolbarClick);
    document.addEventListener('selectionchange', handleSelectionChange);
    noteBodyEditable.addEventListener('focus', updateToolbarStates);
    noteBodyEditable.addEventListener('blur', clearToolbarStates);
    noteBodyEditable.addEventListener('keyup', updateToolbarStates);
    noteBodyEditable.addEventListener('keydown', handleFormattingKeys);
    window.addEventListener('resize', loadSidebarWidth);
}

function handleEditorInput() {
    startAutoSaveTimer();
    updateStatusBar();
     if (document.activeElement === noteBodyEditable) updateToolbarStates();
}
function handleSelectionChange() {
     if (document.activeElement === noteBodyEditable) updateToolbarStates();
}
function startAutoSaveTimer() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => updateNote(), AUTO_SAVE_DELAY);
}
function updateToolbarStates() {
     if (mainViewCurrentState !== 'editor') { clearToolbarStates(); return; };
    requestAnimationFrame(() => {
        editorToolbar.querySelectorAll('.format-btn').forEach(btn => {
            const command = btn.dataset.command; let isActive = false;
            if (command) {
                try {
                    if (command === 'formatBlock' && btn.dataset.value === 'blockquote') isActive = isSelectionInTag('BLOCKQUOTE');
                    else isActive = document.queryCommandState(command);
                } catch (e) {}
            }
            btn.classList.toggle('active', isActive);
        });
    });
}
function isSelectionInTag(tagName) {
    if (!window.getSelection) return false;
    const selection = window.getSelection(); if (!selection || selection.rangeCount === 0) return false;
    let node = selection.getRangeAt(0).commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
    while (node && node !== noteBodyEditable) { if (node.nodeName === tagName) return true; node = node.parentNode; }
    return false;
}
function clearToolbarStates() { editorToolbar.querySelectorAll('.toolbar-btn.active').forEach(btn => btn.classList.remove('active')); }
function handleFormattingKeys(e) {
     if (e.ctrlKey || e.metaKey) {
        let command = null; let value = null;
        switch (e.key.toLowerCase()) {
            case 'b': command = 'bold'; break;
            case 'i': command = 'italic'; break;
            case 'u': command = 'underline'; break;
        }
        if (command) { e.preventDefault(); document.execCommand(command, false, value); handleEditorInput(); updateToolbarStates(); }
    }
}

// --- Start the App ---
initializeApp();
