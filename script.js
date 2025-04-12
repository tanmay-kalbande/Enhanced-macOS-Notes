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
        // Save the current note explicitly before creating a new one
        clearTimeout(autoSaveTimeout);
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
    renderNotesList(); // Re-render sidebar list

    // If search is active, clear input and update the views
    if (mainViewCurrentState === 'search') {
        searchInput.value = '';
        // Don't call handleSearchInput directly, loadNote will set state
    }

    loadNote(0); // Load the new note (index 0)
    noteTitleInput.focus(); // Focus title for immediate editing
}


function loadNote(index) {
    if (index < 0 || index >= notes.length) {
        console.warn(`Attempted to load invalid note index: ${index}`);
        resetEditor();
        return;
    }

    // Save previous note if switching
    if (activeNoteIndex !== null && activeNoteIndex !== index) {
         clearTimeout(autoSaveTimeout);
         updateNote();
    }

    activeNoteIndex = index;
    const note = notes[index];

    noteTitleInput.value = note.title;
    noteBodyEditable.innerHTML = note.content;

    setMainViewState('editor'); // Switch main view to editor

    updateStatusBar();
    updateLastModified(note.timestamp);
    highlightActiveNoteItem(); // Update sidebar highlight
    updateToolbarStates(); // Update formatting buttons

    // Close sidebar on mobile after selecting a note
    if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
        toggleSidebar();
    }
}

function updateNote() {
    // Check if an active note exists and is valid
    if (activeNoteIndex === null || activeNoteIndex >= notes.length) return;

    const currentNote = notes[activeNoteIndex];
    const newTitle = noteTitleInput.value;
    const newContent = noteBodyEditable.innerHTML;

    // Check if title or content actually changed
    if (currentNote.title !== newTitle || currentNote.content !== newContent) {
        currentNote.title = newTitle;
        currentNote.content = newContent;
        currentNote.timestamp = new Date().toISOString();

        // Move the updated note to the top if it wasn't already there
        if (activeNoteIndex !== 0) {
             // Remove from current position and insert at the beginning
             notes.splice(activeNoteIndex, 1);
             notes.unshift(currentNote);
             // Update the active index to reflect the new position
             activeNoteIndex = 0;
             // Re-render immediately because note order changed
             renderNotesList();
        } else {
             // Note is already at the top, just save and update its list item
             saveNotesToStorage(); // Save changes
             renderNotesList(); // Re-render to update timestamp/preview in list
        }

        // Save regardless of position change (needed if only timestamp updated at index 0)
        saveNotesToStorage();
        // Update the "Last Modified" status bar
        updateLastModified(currentNote.timestamp);
    }
}


function deleteNote() {
    if (activeNoteIndex === null || activeNoteIndex >= notes.length) return;

    const noteToDelete = notes[activeNoteIndex];
    const noteTitle = noteToDelete.title || 'Untitled';

    // Confirmation dialog
    if (confirm(`Are you sure you want to delete "${noteTitle}"? This cannot be undone.`)) {
        const wasSearching = (mainViewCurrentState === 'search'); // Check state before modifying notes array
        const deletedNoteId = noteToDelete.id;

        // Remove the note from the array
        notes.splice(activeNoteIndex, 1);
        saveNotesToStorage();

        // Reset the active index since the note is gone
        activeNoteIndex = null;

        if (wasSearching) {
             // If we were searching, re-run the search to update both lists
             // and keep the main view in the 'search' state.
             handleSearchInput();
        } else {
             // If not searching, just update the sidebar list and reset the main area.
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

    setMainViewState('placeholder'); // Switch main view to placeholder

    updateStatusBar(); // Reset stats
    updateLastModified(null); // Clear last modified time
    highlightActiveNoteItem(); // Remove active highlight from sidebar
    updateToolbarStates(); // Deactivate formatting buttons
}

// --- UI Rendering & Updates ---
function renderNotesList(notesToRender = notes) {
    // console.log("Rendering sidebar list with", notesToRender.length, "notes");
    notesListEl.innerHTML = ''; // Clear the current list

    // Iterate through the notes we need to display (either all notes or search results)
    notesToRender.forEach((note) => {
        // Find the original index of this note in the main `notes` array
        // This is crucial because clicks should load based on the original index
        const originalIndex = notes.findIndex(n => n.id === note.id);
        if (originalIndex === -1) return; // Skip if note not found (shouldn't happen ideally)

        const noteItem = document.createElement('li');
        noteItem.classList.add('note-item');
        // Store the original index so we know which note to load on click
        noteItem.setAttribute('data-index', originalIndex);

        // Create a temporary element to safely get text preview from HTML content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = note.content;
        const previewText = tempDiv.textContent || tempDiv.innerText || '';

        let title = note.title || 'Untitled';
        let preview = previewText.substring(0, 100); // Limit preview length

        // Highlight search terms if search is active
        const query = searchInput.value.trim();
        if (query) {
            const terms = query.match(/([+-]?"[^"]+")|([+-]?[\w'-]+)/g) || [];
            terms.forEach(term => {
                // Extract the actual word/phrase to highlight, removing quotes/operators
                const cleanTerm = term.replace(/^["+-\s]+|["\s]+$/g, '');
                 // Don't highlight excluded terms or empty strings
                 if (!cleanTerm || term.startsWith('-')) return;
                try {
                    // Use regex to find the term (case-insensitive, global)
                    const regex = new RegExp(`(${escapeRegExp(cleanTerm)})`, 'gi');
                    // Replace matches with highlighted spans in title
                    title = title.replace(regex, '<span class="highlight-match">$1</span>');
                     // Only highlight preview if it doesn't already contain HTML (simple check)
                     if (!preview.includes('<') && !preview.includes('>')) {
                         preview = preview.replace(regex, '<span class="highlight-match">$1</span>');
                     }
                } catch (e) { console.error("Regex error during sidebar highlight:", e); }
            });
        }

        // Set the inner HTML of the list item
        noteItem.innerHTML = `
            <div class="note-item-title">${title}</div>
            <div class="note-item-preview">${preview || '<span style="color: var(--text-tertiary);">Empty Note</span>'}</div>
            <div class="timestamp">${formatTimestamp(note.timestamp)}</div>
        `;

        // Add click listener to load the note
        noteItem.addEventListener('click', () => {
            // Prevent re-loading the same note
            if (originalIndex === activeNoteIndex) return;
            // Ensure any pending auto-save is cleared/executed
            clearTimeout(autoSaveTimeout);
            updateNote(); // Save the currently open note first
            // Load the clicked note using its original index
            loadNote(originalIndex);
        });

        notesListEl.appendChild(noteItem);
    });

    // Update the notes count display
    updateNotesCount(notesToRender.length, notes.length);
    // Ensure the correct item is highlighted after re-rendering
    highlightActiveNoteItem();
}

function highlightActiveNoteItem() {
    // Ensure only the currently active note item has the 'active' class
    document.querySelectorAll('.note-item').forEach(item => {
        const itemIndex = parseInt(item.getAttribute('data-index'), 10);
        item.classList.toggle('active', itemIndex === activeNoteIndex);
    });
}

function updateNotesCount(shownCount, totalCount) {
    // Display different text depending on whether a search filter is active
    if (searchInput.value.trim() === '' || shownCount === totalCount) {
        notesCountEl.textContent = `${totalCount} note${totalCount !== 1 ? 's' : ''}`;
    } else {
        notesCountEl.textContent = `Found ${shownCount} of ${totalCount}`;
    }
}

function updateStatusBar() {
    // Use requestAnimationFrame to avoid layout thrashing
    requestAnimationFrame(() => {
         // Don't calculate if not in editor view
         if (mainViewCurrentState !== 'editor') {
             wordCountEl.innerHTML = `<i class="fas fa-text-width"></i> 0 words`;
             charCountEl.innerHTML = `<i class="fas fa-pen-nib"></i> 0 characters`;
             readingTimeEl.innerHTML = `<i class="fas fa-clock"></i> 0 min read`;
             return;
         }
         // Get plain text content for accurate counts
         const content = noteBodyEditable.innerText || '';
         const words = content.trim().split(/\s+/).filter(Boolean); // Split by whitespace, remove empty strings
         const wordCount = words.length;
         const charCount = content.length;
         // Calculate reading time (minimum 1 minute if there's content)
         const minutes = wordCount === 0 ? 0 : Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));

         // Update DOM elements
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
        // Check if the date is valid
        if (isNaN(date.getTime())) return "Invalid Date";

        const optionsDate = { year: 'numeric', month: 'short', day: 'numeric' };
        const optionsTime = { hour: '2-digit', minute: '2-digit' };

        // If detailed view is requested, include date and time
        if (includeTime) {
            return `${date.toLocaleDateString(undefined, optionsDate)}, ${date.toLocaleTimeString(undefined, optionsTime)}`;
        } else {
             // Provide relative time for recent notes (Today, Yesterday)
             const today = new Date();
             const yesterday = new Date(today);
             yesterday.setDate(today.getDate() - 1);

             const isToday = date.toDateString() === today.toDateString();
             const isYesterday = date.toDateString() === yesterday.toDateString();

             if (isToday) return date.toLocaleTimeString(undefined, optionsTime); // Just show time for today
             if (isYesterday) return `Yesterday`; // Show "Yesterday"
             return date.toLocaleDateString(undefined, optionsDate); // Show full date for older notes
        }
    } catch (error) {
         console.error("Error formatting timestamp:", isoString, error);
         return "Invalid Date"; // Fallback for errors
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
    localStorage.setItem('darkMode', darkMode); // Persist theme choice
    applyTheme();
}

// --- Sidebar ---
function toggleSidebar() {
    sidebar.classList.toggle('active');
    // Show/hide overlay only on mobile where sidebar is fixed/absolute
    if (overlay) overlay.classList.toggle('active', sidebar.classList.contains('active'));
}


function loadSidebarWidth() {
    // Only apply saved width on larger screens where resizing is possible
    if (window.innerWidth > 768) {
        const savedWidth = localStorage.getItem('sidebarWidth');
        if (savedWidth) {
            try {
                 const numericWidth = parseInt(savedWidth, 10);
                 // Get computed min/max widths to clamp the saved value
                 const minW = parseInt(getComputedStyle(sidebar).minWidth, 10) || 220;
                 const maxW = parseInt(getComputedStyle(sidebar).maxWidth, 10) || 600;
                 if (!isNaN(numericWidth) && numericWidth > 0) {
                      // Apply width only if valid and within bounds
                      sidebar.style.width = `${Math.max(minW, Math.min(numericWidth, maxW))}px`;
                 } else { sidebar.style.width = ''; } // Reset if invalid
            } catch (e) { console.error("Error applying sidebar width:", e); sidebar.style.width = ''; }
        } else { sidebar.style.width = ''; } // Reset if no saved width
    } else {
        // On mobile, always reset width (handled by CSS transform/fixed width)
        sidebar.style.width = '';
    }
}

function startResize(e) {
    // Only allow left mouse button drag
    if (e.button !== 0) return;
    isResizing = true;
    resizeHandle.classList.add('resizing');
    // Change cursor and prevent text selection during resize
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    // Add global listeners for move and mouse up
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize, { once: true }); // `once: true` automatically removes listener after firing
}

function handleResize(e) {
    if (!isResizing) return;
    // Use requestAnimationFrame for performance during rapid mouse movements
    requestAnimationFrame(() => {
        const sidebarRect = sidebar.getBoundingClientRect();
        let newWidth = e.clientX - sidebarRect.left;
        // Clamp width between min and max values defined in CSS or defaults
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
        // Restore default cursor and text selection
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        // Remove the global mousemove listener
        document.removeEventListener('mousemove', handleResize);
        // Save the final width to localStorage
        const finalWidth = sidebar.offsetWidth;
        if (finalWidth > 0) localStorage.setItem('sidebarWidth', finalWidth);
    }
}

// --- Search ---
function handleSearchInput() {
    // Debounce the search input to avoid excessive processing
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const query = searchInput.value.trim();

        if (!query) {
            // If search is cleared, show all notes in sidebar
            renderNotesList(notes);
            // Restore editor or placeholder view based on whether a note was active
            if (activeNoteIndex !== null) {
                setMainViewState('editor');
                 highlightActiveNoteItem(); // Re-highlight potentially lost active state
            } else {
                setMainViewState('placeholder');
            }
            return;
        }

        // Perform the actual search logic
        const searchResults = performSearch(query);
        // Update the sidebar list with only the search results
        renderNotesList(searchResults);
        // Update the main view to show the dedicated search results list
        renderSearchResultsInMainView(searchResults, query);
        // Set the main view state to 'search'
        setMainViewState('search');

    }, 300); // 300ms debounce delay
}


function performSearch(query) {
     // Parse the query into tokens (required, excluded, phrase, normal)
     const tokens = parseSearchQuery(query);
    // If no valid tokens, return all notes (or handle as needed)
    if (!tokens.length) return notes;

    return notes.map(note => {
            // Prepare searchable text (lowercase for case-insensitivity)
            const titleText = note.title.toLowerCase();
            // Safely extract text content from potential HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = note.content;
            const contentText = (tempDiv.textContent || tempDiv.innerText || '').toLowerCase();

            let score = 0; // Score for ranking results
            let meetsRequirements = true; // Track if required terms are met
            let matchedPositive = false; // Track if any non-excluded term matched

            tokens.forEach(token => {
                let found = false; // Flag if this specific token is found
                const searchTerm = token.text;
                const isExcluded = token.type === 'excluded';

                if (!searchTerm) return; // Skip empty tokens

                 try {
                     // Create regex based on token type (phrase vs. word boundary)
                     const regex = new RegExp(
                         token.type === 'phrase' ? escapeRegExp(searchTerm) : `\\b${escapeRegExp(searchTerm)}`,
                         'gi' // Global, case-insensitive
                     );
                     // Check title and content, assign scores
                     if (titleText.match(regex)) { score += (isExcluded ? 0 : 10); found = true; } // Higher score for title match
                     if (contentText.match(regex)) { score += (isExcluded ? 0 : 5); found = true; }
                 } catch(e) { console.error("Regex error in search:", e); }

                // Update requirement flags based on findings
                if (token.type === 'required' && !found) meetsRequirements = false;
                if (isExcluded && found) meetsRequirements = false; // Excluded term found
                if (!isExcluded && found) matchedPositive = true; // A positive term matched
            });

            // Final checks:
            // - Must meet all requirements (required terms found, excluded terms not found)
            // - If there were any positive terms in the query, at least one must have matched
            const hasPositiveTokens = tokens.some(t => t.type !== 'excluded');
            if (!meetsRequirements || (hasPositiveTokens && !matchedPositive)) {
                return null; // Filter this note out
            }

            // Return note with its score for sorting
            return { note, score };
        })
        .filter(result => result !== null) // Remove null results (filtered notes)
        .sort((a, b) => b.score - a.score) // Sort by score descending
        .map(result => result.note); // Extract just the note objects
}

function parseSearchQuery(query) {
    const tokens = [];
    // Regex to match: "exact phrases", +required, -excluded, or normal words
    const regex = /([+-]?"[^"]+")|([+-]?[\w'-]+)/g;
    let match;

    while ((match = regex.exec(query)) !== null) {
        let term = match[0];
        let type = 'normal'; // Default type
        let text = term;

        // Determine type based on prefix
        if (term.startsWith('+')) { type = 'required'; text = term.substring(1); }
        else if (term.startsWith('-')) { type = 'excluded'; text = term.substring(1); }

        // Handle quoted phrases (remove quotes)
        if (text.startsWith('"') && text.endsWith('"')) {
            // Keep 'required' or 'excluded' type if already set, otherwise mark as 'phrase'
            type = (type === 'required' || type === 'excluded') ? type : 'phrase';
            text = text.substring(1, text.length - 1);
        }

        text = text.trim().toLowerCase(); // Normalize text
        if (text) { // Only add token if text is not empty
             tokens.push({ text: text, type });
        }
    }
    return tokens;
}


function escapeRegExp(string) {
    // Escape special regex characters to treat search terms literally
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- Render Search Results in Main View ---
function renderSearchResultsInMainView(results, query) {
    // Display the search query in the header
    searchResultsHeaderQuery.textContent = query;
    searchResultsListContainer.innerHTML = ''; // Clear previous results

    if (results.length === 0) {
        // Show "No results" message if applicable
        searchNoResultsMsg.style.display = 'block';
        searchResultsListContainer.style.display = 'none'; // Hide the container
    } else {
        // Hide "No results" message and show the container
        searchNoResultsMsg.style.display = 'none';
        searchResultsListContainer.style.display = 'block';

        // Create list items for each result
        results.forEach(note => {
            // Find original index for linking
            const originalIndex = notes.findIndex(n => n.id === note.id);
            if (originalIndex === -1) return;

            const item = document.createElement('div');
            item.classList.add('search-result-item');
            item.setAttribute('data-index', originalIndex);

            // Extract plain text for snippet generation
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = note.content;
            const contentText = tempDiv.textContent || tempDiv.innerText || '';

            let snippetHTML = contentText.substring(0, 250); // Default snippet

            // Find positive search terms for highlighting and context
             const terms = parseSearchQuery(query);
             const positiveTerms = terms.filter(t => t.type !== 'excluded' && t.text);

             // Try to find the first match to create a context snippet
             let firstMatchIndex = -1;
             if (positiveTerms.length > 0) {
                  for (const term of positiveTerms) {
                       try {
                            // Find the first occurrence of any positive term
                            const regex = new RegExp(term.type === 'phrase' ? escapeRegExp(term.text) : `\\b${escapeRegExp(term.text)}`, 'i'); // Case-insensitive
                            const match = contentText.match(regex);
                            if (match && match.index !== undefined) {
                                firstMatchIndex = match.index;
                                break; // Stop after finding the first match
                            }
                       } catch (e) {} // Ignore regex errors during snippet finding
                  }
             }

             // If a match was found, create a snippet around it
             if (firstMatchIndex !== -1) {
                  const start = Math.max(0, firstMatchIndex - 80); // Start ~80 chars before
                  const end = Math.min(contentText.length, firstMatchIndex + 170); // End ~170 chars after
                  // Add ellipsis if snippet doesn't start/end at the actual text boundaries
                  snippetHTML = (start > 0 ? '... ' : '') + contentText.substring(start, end) + (end < contentText.length ? ' ...' : '');
             }

            let title = note.title || 'Untitled';

            // Apply highlighting to title and snippet using positive terms
             positiveTerms.forEach(term => {
                 try {
                     const regex = new RegExp(escapeRegExp(term.text), 'gi');
                     const replacer = (match) => `<span class="highlight-match">${match}</span>`;
                     // Avoid double-highlighting if already done in sidebar render
                     if (!title.includes('highlight-match')) {
                        title = title.replace(regex, replacer);
                     }
                     snippetHTML = snippetHTML.replace(regex, replacer);
                 } catch (e) { console.error("Regex error during search result highlight:", e); }
             });

            // Set inner HTML for the result item
            item.innerHTML = `
                <div class="search-result-note-title">${title}</div>
                <div class="search-result-snippet">${snippetHTML || '<span style="color: var(--text-tertiary);">Empty Note</span>'}</div>
            `;

            // Add click listener to load the note
            item.addEventListener('click', () => {
                clearTimeout(autoSaveTimeout); // Clear pending saves
                loadNote(originalIndex); // Load the clicked note
                // Optional: Clear search input on click to exit search mode
                // searchInput.value = '';
                // handleSearchInput();
            });
            searchResultsListContainer.appendChild(item);
        });
    }
}


// --- Import/Export ---
function exportAllNotes() {
     if (notes.length === 0) {
        showNotification("No notes to export.", true);
        return;
     }
    try {
        // Convert notes array to JSON string
        const dataStr = JSON.stringify(notes, null, 2); // Pretty print JSON
        const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Generate filename with current date
        a.download = `notes_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a); // Required for Firefox
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url); // Clean up blob URL
        showNotification('All notes exported successfully!');
    } catch (error) {
        console.error("Export failed:", error);
        showNotification('Failed to export notes.', true);
    }
}

function triggerImport() {
    // Programmatically click the hidden file input
    importFileInput.click();
}

function importNotes(event) {
     const file = event.target.files[0];
     if (!file) return; // No file selected

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            let notesToImport = [];

            // Check if imported data is an array directly or nested under 'notes'
            if (Array.isArray(importedData)) {
                notesToImport = importedData;
            } else if (importedData && Array.isArray(importedData.notes)) {
                notesToImport = importedData.notes; // Handle potential wrapper object
            } else {
                throw new Error("Invalid format: Expected an array of notes.");
            }

            // Validate and sanitize imported notes
            const validNotes = notesToImport
                .filter(note => note && typeof note.content === 'string' && note.timestamp && (!note.id || typeof note.id === 'string'))
                .map(note => ({
                    id: note.id || Date.now().toString() + Math.random().toString(16).substring(2), // Ensure ID exists
                    title: typeof note.title === 'string' ? note.title : '', // Ensure title is string
                    content: note.content,
                    timestamp: note.timestamp // Assume timestamp is valid ISO string
                }));

            const invalidCount = notesToImport.length - validNotes.length;

            if (validNotes.length === 0) {
                if (notesToImport.length > 0) throw new Error("No valid notes found in the file.");
                else { showNotification("Selected file contains no notes.", true); return; }
            }

            // Merge new notes, avoiding duplicates by ID
            const existingIds = new Set(notes.map(n => n.id));
            const newNotes = validNotes.filter(n => !existingIds.has(n.id));
            const updatedNotesCount = validNotes.length - newNotes.length; // Count skipped duplicates

            notes = [...newNotes, ...notes]; // Add new notes to the beginning
            notes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Re-sort by timestamp

            saveNotesToStorage();

            // Clear search and reset UI
            if (mainViewCurrentState === 'search') searchInput.value = '';
            renderNotesList();
            resetEditor(); // Go to placeholder view

            // Provide feedback notification
            let message = `${newNotes.length} new note(s) imported.`;
            if (updatedNotesCount > 0) message += ` ${updatedNotesCount} existing notes skipped.`;
            if (invalidCount > 0) message += ` ${invalidCount} invalid items ignored.`;
            showNotification(message);

        } catch (error) {
            console.error("Import failed:", error);
            showNotification(`Import failed: ${error.message}`, true);
        }
        finally {
            // Reset file input value to allow importing the same file again if needed
            importFileInput.value = '';
        }
    };

    reader.onerror = () => {
        showNotification('Error reading file.', true);
        importFileInput.value = '';
    };
    reader.readAsText(file); // Read the file as text
}

function exportCurrentNote() {
     // Ensure a note is active in the editor view
     if (mainViewCurrentState !== 'editor' || activeNoteIndex === null) {
         showNotification("No active note selected to export.", true);
         return;
     }
    const note = notes[activeNoteIndex];
    const title = note.title || 'Untitled';

    try {
        // Create plain text version for export
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = note.content;
        const textContent = tempDiv.textContent || tempDiv.innerText || '';
        const dataStr = `Title: ${note.title}\n\n---\n\n${textContent}`;

        const blob = new Blob([dataStr], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Sanitize title for filename
        a.download = `${title.replace(/[^a-z0-9 _-]/gi, '_')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification(`Note "${title}" exported as text.`);
    } catch (error) {
        console.error("Export current note failed:", error);
        showNotification('Failed to export current note.', true);
    }
}

// --- Notifications ---
function showNotification(message, isError = false) {
     notificationMessage.textContent = message;
     // Set icon and class based on error status
    notificationIcon.className = isError ? 'fas fa-exclamation-circle error-icon' : 'fas fa-check-circle success-icon';
    notification.classList.toggle('error', isError);

    // Clear any existing timeout to prevent premature hiding
    clearTimeout(notification.timerId);
    // Force reflow to restart animation if notification is already shown
    notification.classList.remove('show');
    void notification.offsetWidth; // Trigger reflow

    // Show notification and set timer to hide it
    notification.classList.add('show');
    notification.timerId = setTimeout(() => {
        notification.classList.remove('show');
    }, 3500); // Hide after 3.5 seconds
}

// --- Rich Text Editing (Legacy `execCommand`) ---
// NOTE: `document.execCommand` is deprecated. Consider migrating to a modern library like TipTap.
function handleToolbarClick(e) {
     // Find the button element, even if the icon inside was clicked
     let target = e.target;
    while (target && target !== editorToolbar && !target.classList.contains('toolbar-btn')) {
        target = target.parentElement;
    }

    // Only execute if in editor view
    if (mainViewCurrentState === 'editor' && target && target.classList.contains('format-btn')) {
        // Ensure focus is in the editor before executing command
        if (!noteBodyEditable.contains(document.activeElement)) {
             noteBodyEditable.focus();
             // Delay command execution slightly to allow focus to settle
             setTimeout(() => executeFormatCommand(target), 50);
        } else {
             executeFormatCommand(target);
        }
    }
}

function executeFormatCommand(target) {
     if (target && target.classList.contains('format-btn')) {
        const command = target.dataset.command;
        const value = target.dataset.value || null; // Get value for commands like 'formatBlock'
        if (command) {
            document.execCommand(command, false, value);
            handleEditorInput(); // Trigger updates after command
            updateToolbarStates(); // Update button active states
        }
    }
}

// --- Paste Handling (Preserve Line Breaks) ---
function handlePasteAsPlainText(e) {
    // Prevent the default paste behavior (which includes HTML formatting)
    e.preventDefault();

    // Get the plain text version of the clipboard data
    const text = (e.originalEvent || e).clipboardData?.getData('text/plain');

    if (text) {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return; // Exit if no selection/cursor

        // Split the plain text into lines based on newline characters
        // Handles both Windows (\r\n) and Unix (\n) line endings
        const lines = text.split(/\r?\n/);

        const range = selection.getRangeAt(0);
        range.deleteContents(); // Remove selected content before pasting

        // Use a DocumentFragment for efficiency when inserting multiple nodes
        const fragment = document.createDocumentFragment();
        let lastNode = null; // Keep track of the last node added for cursor positioning

        // Iterate through the lines
        lines.forEach((line, index) => {
            // Add the text content for the current line
            if (line.length > 0) {
                const textNode = document.createTextNode(line);
                fragment.appendChild(textNode);
                lastNode = textNode; // Update last node
            }

            // Add a <br> tag after each line EXCEPT the last one
            if (index < lines.length - 1) {
                const br = document.createElement('br');
                fragment.appendChild(br);
                lastNode = br; // Update last node
            }
        });

        // Insert the entire fragment (lines and breaks) at the cursor position
        range.insertNode(fragment);

        // --- Move the cursor to the end of the inserted content ---
        if (lastNode) { // Check if any node was actually added
            const newRange = document.createRange();
            // Place the start and end of the range immediately after the last inserted node
            newRange.setStartAfter(lastNode);
            newRange.setEndAfter(lastNode);

            // Clear the old selection and add the new range, effectively moving the cursor
            selection.removeAllRanges();
            selection.addRange(newRange);
        }
        // --- Cursor moved ---

        // Manually trigger updates
        handleEditorInput();
    }
}


// --- Event Listeners ---
function addEventListeners() {
    newNoteBtn.addEventListener('click', createNote);
    noteTitleInput.addEventListener('input', startAutoSaveTimer); // Auto-save on title change
    noteBodyEditable.addEventListener('input', handleEditorInput); // Auto-save, status update on body change
    noteBodyEditable.addEventListener('paste', handlePasteAsPlainText); // Add paste handler
    deleteNoteBtn.addEventListener('click', deleteNote);
    themeSwitchBtn.addEventListener('click', toggleTheme);
    if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
    if (overlay) overlay.addEventListener('click', toggleSidebar); // Close sidebar on overlay click
    searchInput.addEventListener('input', handleSearchInput); // Trigger search on input
    searchInput.addEventListener('search', () => { // Handle clearing search via 'x' button
        if (!searchInput.value) handleSearchInput();
    });
    exportAllBtn.addEventListener('click', exportAllNotes);
    importBtn.addEventListener('click', triggerImport);
    importFileInput.addEventListener('change', importNotes); // Handle file selection for import
    exportNoteBtn.addEventListener('click', exportCurrentNote);
    if (resizeHandle) resizeHandle.addEventListener('mousedown', startResize);
    else console.warn("Resize handle not found. Resizing disabled.");
    editorToolbar.addEventListener('click', handleToolbarClick); // Handle formatting button clicks
    // Update toolbar states based on selection/focus changes
    document.addEventListener('selectionchange', handleSelectionChange);
    noteBodyEditable.addEventListener('focus', updateToolbarStates);
    noteBodyEditable.addEventListener('blur', clearToolbarStates); // Clear states when editor loses focus
    noteBodyEditable.addEventListener('keyup', updateToolbarStates); // Update on key release (affects selection)
    noteBodyEditable.addEventListener('keydown', handleFormattingKeys); // Handle Ctrl+B/I/U shortcuts
    window.addEventListener('resize', loadSidebarWidth); // Adjust sidebar width logic on resize
}

function handleEditorInput() {
    startAutoSaveTimer(); // Trigger auto-save timer on any input
    updateStatusBar(); // Update word count etc.
     // Update toolbar only if focus is still within the editor body
     if (document.activeElement === noteBodyEditable) {
        updateToolbarStates();
     }
}

function handleSelectionChange() {
     // Update toolbar state only when the editor body is the active element where selection occurs
     if (document.activeElement === noteBodyEditable) {
        updateToolbarStates();
     }
}

function startAutoSaveTimer() {
    clearTimeout(autoSaveTimeout); // Reset existing timer
    autoSaveTimeout = setTimeout(() => {
        // Check if still in editor mode before saving
        if (mainViewCurrentState === 'editor') {
            updateNote();
        }
    }, AUTO_SAVE_DELAY);
}

function updateToolbarStates() {
     // Don't try to update if not in editor view
     if (mainViewCurrentState !== 'editor') {
         clearToolbarStates();
         return;
     };
    // Use rAF for performance
    requestAnimationFrame(() => {
        editorToolbar.querySelectorAll('.format-btn').forEach(btn => {
            const command = btn.dataset.command;
            let isActive = false;
            if (command) {
                try {
                    // Special handling for block elements like blockquote
                    if (command === 'formatBlock' && btn.dataset.value === 'blockquote') {
                        isActive = isSelectionInTag('BLOCKQUOTE');
                    } else {
                        // Use queryCommandState for standard inline formats
                        isActive = document.queryCommandState(command);
                    }
                } catch (e) {
                    // Ignore errors from queryCommandState if command is unsupported
                }
            }
            btn.classList.toggle('active', isActive); // Toggle 'active' class on the button
        });
    });
}

// Helper function to check if the current selection is inside a specific HTML tag
function isSelectionInTag(tagName) {
    if (!window.getSelection) return false;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    let node = selection.getRangeAt(0).commonAncestorContainer;
    // If the common ancestor is a text node, start checking from its parent element
    if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentNode;
    }
    // Traverse up the DOM tree from the selection's ancestor
    while (node && node !== noteBodyEditable) { // Stop if we reach the editor root
        if (node.nodeName === tagName) {
            return true; // Found the tag
        }
        node = node.parentNode; // Move up to the parent
    }
    return false; // Tag not found in the selection's ancestry
}


function clearToolbarStates() {
    // Remove 'active' class from all formatting buttons
    editorToolbar.querySelectorAll('.toolbar-btn.active').forEach(btn => btn.classList.remove('active'));
}

function handleFormattingKeys(e) {
     // Check for Ctrl (Windows/Linux) or Meta (Mac) key
     if (e.ctrlKey || e.metaKey) {
        let command = null;
        let value = null; // Not typically needed for B/I/U

        // Map keys to execCommand commands
        switch (e.key.toLowerCase()) {
            case 'b': command = 'bold'; break;
            case 'i': command = 'italic'; break;
            case 'u': command = 'underline'; break;
        }

        // If a matching command was found, execute it
        if (command) {
            e.preventDefault(); // Prevent default browser behavior (e.g., opening bookmarks for Ctrl+B)
            document.execCommand(command, false, value);
            handleEditorInput(); // Trigger updates after command execution
            updateToolbarStates(); // Update button states immediately
        }
    }
}

// --- Start the App ---
initializeApp();
