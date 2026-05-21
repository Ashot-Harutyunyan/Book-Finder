const form= document.forms[0]
const searchInput= form.querySelector('.search-input')
const searchBtn= form.querySelector('.search-btn')
const buttonSearchSpinner = searchBtn.querySelector('.spinner')
const buttonSearchText = searchBtn.querySelector('.text')
const template= document.getElementById('loading-template')
const loadingState= document.querySelector('.loading-state')
const emptyState= document.querySelector('.empty-state')
const errorState= document.querySelector('.error-state')
const noResultsState= document.querySelector('.no-results-state')
const booksGrid= document.querySelector('.books-grid')
const dialog= document.getElementById('dialog')
const dialogBook= document.querySelector('.dialog-book')
const dialogLoading= document.querySelector('.dialog-loading')
const dialogError= document.querySelector('.dialog-error')
const dialogCloseButton= document.querySelector('.dialog-close-btn')
const dialogTitle= document.querySelector('.dialog-book-header h2')
const dialogSubTitle= document.querySelector('.dialog-book-header p')
const dialogCover= document.querySelector('.cover img')
const dialogValues= dialog.querySelectorAll('.info .value')
const tagsContainer= dialog.querySelector('.tags')
const dialogDescription= document.querySelector('.dialog-book-description')
const bookUrls= dialog.querySelectorAll('.dialog-book-buttons a')

const bookStore = new Map()
const searchCache = new Map()
const CACHE_TTL = 5 * 60 * 1000
let searchController = null

for (let i = 0; i < 8; i++) {
    loadingState.appendChild(template.content.cloneNode(true))
}

const dialogErrorState = errorState.cloneNode(true)
dialogErrorState.className = 'dialog-error-state'
dialogError.appendChild(dialogErrorState)

dialog.setAttribute('aria-label', 'Book details')
dialogCloseButton.setAttribute('aria-label', 'Close dialog')

function setText(element, text) {
    element.textContent = text ?? ''
}

function hideAllStates() {
    emptyState.classList.add('hidden')
    loadingState.classList.add('hidden')
    errorState.classList.add('hidden')
    noResultsState.classList.add('hidden')
    booksGrid.classList.add('hidden')
}

function hideAllDialogStates() {
    dialogBook.classList.add('hidden')
    dialogLoading.classList.add('hidden')
    dialogError.classList.add('hidden')
}

function setSearchLoading(isLoading) {
    buttonSearchSpinner.classList.toggle('hidden', !isLoading)
    buttonSearchText.classList.toggle('hidden', isLoading)

    searchBtn.disabled = isLoading
}

function getCached(query) {
    const entry = searchCache.get(query)
    if (!entry) return null
    if (Date.now() - entry.timestamp > CACHE_TTL) {
        searchCache.delete(query)
        return null
    }
    return entry.data
}

function createBookCard(book) {
    const card = document.createElement('div')
    card.className = 'book-card'

    const imgWrapper = document.createElement('div')
    imgWrapper.className = 'book-card-container-img'
    const img = document.createElement('img')
    const coverSrc = book.cover_i
        ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
        : './img/books.png'
    img.src = coverSrc
    img.alt = book.title ?? 'Book cover'
    img.loading = 'lazy'
    img.decoding = 'async'
    imgWrapper.appendChild(img)

    const title = document.createElement('h3')
    title.className = 'book-card-title'
    setText(title, book.title)

    const author = document.createElement('p')
    author.className = 'book-card-subtitle'
    setText(author, book.author_name?.join(', ') || 'Unknown author')

    const year = document.createElement('p')
    year.className = 'book-card-subtitle'
    setText(year, book.first_publish_year ?? '')

    const btn = document.createElement('button')
    btn.className = 'button-view-details'
    btn.textContent = 'View Details'
    btn.dataset.bookKey = book.key
    card.append(imgWrapper, title, author, year, btn)
    return card
}

function displayBooks(books) {
    booksGrid.classList.remove('hidden')
    bookStore.clear()

    const fragment = document.createDocumentFragment()
    books.forEach((book) => {
        bookStore.set(book.key, {
            key: book.key,
            title: book.title ?? '',
            authorName: book.author_name?.join(', ') || 'Unknown author',
            year: book.first_publish_year ?? '',
            editionCount: book.edition_count ?? '—',
            ebookAccess: book.ebook_access ?? '—',
            previewId: book.ia?.[0] ?? '',
            cover: book.cover_i
                ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
                : './img/books.png',
        })
        fragment.appendChild(createBookCard(book))
    })

    booksGrid.innerHTML = ''
    booksGrid.appendChild(fragment)
}

async function submitForm(e) {
    e.preventDefault()
    const value = searchInput.value.trim()
    if (!value) return

    if (searchController) {
        searchController.abort()
    }

    const cached = getCached(value)
    if (cached) {
        hideAllStates()
        if (cached.length === 0) {
            noResultsState.classList.remove('hidden')
        } else {
            displayBooks(cached)
        }
        return
    }

    searchController = new AbortController()
    const { signal } = searchController

    try {
        hideAllStates()
        setSearchLoading(true)
        loadingState.classList.remove('hidden')

        const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(value)}&limit=20&fields=title,author_name,cover_i,first_publish_year,key,edition_count,ebook_access,ia`
        const response = await fetch(url, { signal })

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`)
        }

        const data = await response.json()
        const docs = data.docs ?? []

        searchCache.set(value, { data: docs, timestamp: Date.now() })

        hideAllStates()
        if (docs.length === 0) {
            noResultsState.classList.remove('hidden')
            return
        }
        displayBooks(docs)

    } catch (err) {
        if (err.name === 'AbortError') return
        console.error(err)
        hideAllStates()
        errorState.classList.remove('hidden')
    } finally {
        setSearchLoading(false)
    }
}

async function openDialog(e) {
    const btn = e.target.closest('.button-view-details')
    if (!btn) return

    const bookKey = btn.dataset.bookKey
    const book = bookStore.get(bookKey)
    if (!book) return

    dialog.showModal()
    dialog.setAttribute('aria-busy', 'true')
    document.body.style.overflow = 'hidden'

    dialogCloseButton.focus()

    try {
        hideAllDialogStates()
        dialogLoading.classList.remove('hidden')

        const response = await fetch(`https://openlibrary.org${book.key}.json`)
        if (!response.ok) throw new Error(`HTTP error ${response.status}`)

        const data = await response.json()

        setText(dialogTitle, data.title || book.title)
        setText(dialogSubTitle, `by ${book.authorName}`)

        dialogCover.src = book.cover
        dialogCover.alt = data.title || book.title

        setText(dialogValues[0], book.year || '—')
        setText(dialogValues[1], book.editionCount)
        setText(dialogValues[2], book.ebookAccess)

        const tagFragment = document.createDocumentFragment()
        data.subjects?.slice(0, 5).forEach((subject) => {
            const span = document.createElement('span')
            span.className = 'tag'
            setText(span, subject)
            tagFragment.appendChild(span)
        })
        tagsContainer.innerHTML = ''
        tagsContainer.appendChild(tagFragment)

        const description = typeof data.description === 'object'
            ? (data.description?.value || 'No description available.')
            : (data.description || 'No description available.')
        setText(dialogDescription, description)

        const openLibUrl = `https://openlibrary.org${book.key}`
        bookUrls[0].href = book.previewId
            ? `https://archive.org/details/${book.previewId}`
            : openLibUrl
        bookUrls[1].href = openLibUrl

        hideAllDialogStates()
        dialogBook.classList.remove('hidden')

    } catch (err) {
        console.error(err)
        hideAllDialogStates()
        dialogError.classList.remove('hidden')
    } finally {
        dialog.setAttribute('aria-busy', 'false')
    }
}

function closeDialog(e) {
    if (e.target !== e.currentTarget) return
    dialog.close()
    document.body.style.overflow = ''
}

function toggleSearchButton(e){
    searchBtn.disabled = e.target.value.length === 0
}

form.addEventListener('submit', submitForm)
booksGrid.addEventListener('click', openDialog)
dialog.addEventListener('click', closeDialog)
dialogCloseButton.addEventListener('click', closeDialog)
dialog.addEventListener('close', () => document.body.style.overflow = '')
searchInput.addEventListener('input', toggleSearchButton)