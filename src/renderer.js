const _ = require('lodash'),
  elasticlunr = require('elasticlunr'),
  lozad = require('lozad'),
  issues = _.reverse(require('./assets/db/issues.json')),
  articlesIndex = require('./assets/db/search/articles.idx.json'),
  pdfjs = require('pdfjs-dist'),
  yearOptions = require('./assets/json/year.json'),
  hash = require('object-hash')

  const ipcRenderer = require('electron').ipcRenderer

pdfjs.GlobalWorkerOptions.workerSrc = "../node_modules/pdfjs-dist/build/pdf.worker.js";

let searchParams = {
  searchTerm: null,
  searchResults: null,
  searchType: 'exact',
  searchUseTitle: 'active',
  searchUseKeywords: 'active',
  searchFullText: false,
  articleTypeFilter: false,
  articleTypeFilters: [],
  projectTypeFilter: false,
  projectTypeFilters: [],
  startYear: '1993',
  endYear: '2019',
  sortOrder: 1,
  searchResultCount: 0,
}

let homeConfig = {
  sortOrderIssues: 1
}

let globalBookmarks = []

const Home = {
  template: '#home',
  data: () => ({
    issues,
    showBookCover: true,
    fields: [{
        key: 'month',
        sortable: false,
        label: 'Month',
      },
      {
        key: 'year',
        sortable: false,
        label: 'Year',
      },
      {
        key: 'id',
        sortable: false,
        label: 'Issue',
      },
      {
        key: 'action',
        label: 'Action'
      }
    ],
    searchResultfields: [{
        key: 'issue',
        sortable: false,
        label: 'Issue',
      },
      {
        key: 'article_title',
        sortable: false,
        label: 'Article',
      },
      {
        key: 'page',
        sortable: false,
        label: 'Page',
      },
      {
        key: 'action',
        label: 'Action'
      }
    ],
    searchIndex: elasticlunr.Index.load(articlesIndex),
    searchParams,
    startYearOptions: yearOptions,
    endYearOptions: JSON.parse(JSON.stringify(yearOptions)),
    config: homeConfig,
    bookmarks: [],
    displayBookmarks: false,
    searchHash: null,
    magazineType: 0,
  }),
  created: function () {

  },
  watch: {
    searchTerm(value) {
      if(value === '' || value === null) {
        this.searchParams.searchResults = null
        this.searchParams.searchResultCount = 0

        if(this.showBookCover) {
          this.setupBookShelfLazyLoading()
        }
      }
    },
    'searchParams.searchResults': function (val, oldVal) {
      _.delay(function(){
        let searchResultThumbs = document.querySelectorAll('.sr-lazy-thumb');
        if (window.searchResultThumbObserver && window.searchResultThumbObserver.observer) {
          window.searchResultThumbObserver.observer.disconnect();
          delete window.searchResultThumbObserver;
        }

        for (let i = 0, len = searchResultThumbs.length; i < len; i++) {
          searchResultThumbs[i].removeAttribute('src');
          searchResultThumbs[i].setAttribute('data-loaded', false);
        }

        window.searchResultThumbObserver = lozad(searchResultThumbs);
        window.searchResultThumbObserver.observe();
      }, 100)
    }
  },
  computed: {
    thumnailViewEnabled() {
      return this.showBookCover
    },
    listViewEnabled() {
      return !this.showBookCover
    },
    showSearchResults() {
      return this.searchParams.searchResults != null
    },
    searchTerm() {
      return this.searchParams.searchTerm
    },
    sortOrderNewestFirst() {
      return this.config.sortOrderIssues === 1
    },
    sortOrderOldestFirst() {
      return this.config.sortOrderIssues === 2
    },
    sortOrderSearchNewestFirst() {
      return this.searchParams.sortOrder === 1
    },
    sortOrderSearchOldestFirst() {
      return this.searchParams.sortOrder === 2
    },
    sortOrderSearchA2Z() {
      return this.searchParams.sortOrder === 4
    },
    sortOrderSearchZ2A() {
      return this.searchParams.sortOrder === 3
    },
    issueCount() {
      if(this.magazineType == 0) {
        return this.issues.length
      } else {
        const filtered = _.filter(this.issues, (i) => {
          return i.type == this.magazineType
        })

        return filtered.length
      }
    },
    magazineTypeToDisplay() {
      return this.magazineType
    }
  },
  methods: {
    thumb(index) {
      const issueNumber = _.padStart(index, 4, '0')
      return "assets/thumbs/" + issueNumber + "/" + issueNumber + ".pdf_0001.jpg"
    },
    resetSearchFilter() {
      this.searchParams.searchTerm = null;
      this.searchParams.searchResults = null;
      this.searchParams.searchType = 'exact';
      this.searchParams.searchUseTitle = 'active';
      this.searchParams.searchUseKeywords = 'active';
      this.searchParams.searchFullText = false;
      this.searchParams.articleTypeFilter = false;
      this.searchParams.articleTypeFilters = [];
      this.searchParams.projectTypeFilter = false;
      this.searchParams.projectTypeFilters = [];
      this.searchParams.startYear = '1993';
      this.searchParams.endYear = '2019';
      this.searchParams.sortOrder = 1;
      this.searchParams.searchResultCount = 0;
    },
    showBookmarksModal() {
      this.$refs.bookmarksRef.show()
    },
    showAboutModal() {
      this.$refs.aboutRef.show()
    },
    showHelpModal() {
      this.$refs.helpRef.show()
    },
    toggleBookShelfDisplay() {
      this.showBookCover = !this.showBookCover
      if(this.showBookCover) {
        this.setupBookShelfLazyLoading()
      }
    },
    getPagePreview(issue, page) {
      const issueNumber = _.padStart(issue, 4, '0'),
        pageNumber = _.padStart(page, 4, '0')

      return "assets/thumbs/" + issueNumber + "/" + issueNumber + ".pdf_" + pageNumber + ".jpg"
    },
    containsAll(needles, haystack){
      const filtered = _.filter(needles, (n) => {
        return haystack.includes(n)
      })

      return (filtered.length === needles.length)
    },
    setMagazineType(type) {
      if(this.magazineType != type) {
        this.magazineType = type
      }
    },
    listViewRowClass( item, type ) {
        if ( !item )
          return;
        if ( this.magazineType != 0 && this.magazineType != item.type)
          return 'd-none';
    },
    doSearch() {
      this.searchParams.searchTerm = _.trim(this.searchParams.searchTerm)
      const searchParamHash = hash(this.searchParams, {
        excludeKeys: function (key) {
          if (key === 'searchResults' || key === 'searchResultCount') {
            return true;
          }
          return false;
        }
      })

      if(this.searchHash != searchParamHash) {
        this.searchHash = searchParamHash
        if(this.searchParams.searchFullText) {
          ipcRenderer.send('fullTextSearch', this.searchParams.searchTerm);
        } else {
          let fields = {}
  
          if(this.searchParams.searchUseTitle === 'active') {
            fields.article_title = {
              boost: 2
            }
          }
  
          if(this.searchParams.searchUseKeywords === 'active') {
            fields.keywords = {
              boost: 2
            }
          }
  
          const indexSearchResults = this.searchIndex.search(this.searchParams.searchTerm, {
            fields: fields
          })
  
          this.searchParams.searchResults = []
  
          let articleBuffer = []
  
          const sortOrder = (this.searchParams.sortOrder % 2 === 0) ? 'asc' : 'desc',
            startYear =  parseInt(this.searchParams.startYear),
            endYear =  parseInt(this.searchParams.endYear)
  
          _.each(indexSearchResults, (r) => {
            let article = this.searchIndex.documentStore.getDoc(r.ref)
            if(!article.hasOwnProperty('dest')) {
              article.dest = article.page + 2
            }
            articleBuffer.push(article)
          })
  
          if(this.searchParams.searchType === 'exact') {
            const termFilter = this.searchParams.searchTerm.toUpperCase()
            articleBuffer = _.filter(articleBuffer, (a) => {
              return a.article_title.toUpperCase().includes(termFilter)
                || a.article_sub_title.toUpperCase().includes(termFilter)
                || a.keywords.toUpperCase().includes(termFilter)
            })
          }
  
          if(this.searchParams.searchType === 'and') {
            const termFilter = this.searchParams.searchTerm.toUpperCase().split(' ')
            articleBuffer = _.filter(articleBuffer, (a) => {
              return this.containsAll(termFilter, a.article_title.toUpperCase())
                || this.containsAll(termFilter, a.article_sub_title.toUpperCase())
                || this.containsAll(termFilter, a.keywords.toUpperCase())
            })
          }
  
          if(this.searchParams.articleTypeFilter && this.searchParams.articleTypeFilters.length > 0) {
            articleBuffer = _.filter(articleBuffer, (a) => {
              return _.includes(this.searchParams.articleTypeFilters, a.article_type)
            })
          }
  
          if(this.searchParams.projectTypeFilter && this.searchParams.projectTypeFilters.length > 0) {
            articleBuffer = _.filter(articleBuffer, (a) => {
              return _.includes(this.searchParams.projectTypeFilters, a.project_type)
            })
          }
  
          articleBuffer = _.filter(articleBuffer, (a) => {
            let articleYear = parseInt(a.issue_year.split('/', 1)[0])
            return articleYear >= startYear && articleYear <= endYear
          })
  
          if(this.searchParams.sortOrder < 3) {
            this.searchParams.searchResults = _.orderBy(articleBuffer, ['id'], [sortOrder])
          }
  
          if(this.searchParams.sortOrder > 2) {
            this.searchParams.searchResults = _.orderBy(articleBuffer, ['article_title'], [sortOrder])
          }
  
          this.searchParams.searchResultCount = this.searchParams.searchResults.length
        }
      }
    },
    toggleSortOrderIssues() {
      this.config.sortOrderIssues > 1 ? this.config.sortOrderIssues -= 1 : this.config.sortOrderIssues += 1

      this.issues = _.reverse(this.issues)

      if(!this.showBookCover) {
        this.$refs.tblWoodIssues.refresh()
      } else {
        this.setupBookShelfLazyLoading()
      }
    },
    setSortOrderSearch(sortId) {
      this.searchParams.sortOrder =  sortId
      let sortOrder = (this.searchParams.sortOrder % 2 === 0) ? 'asc' : 'desc'

      if(this.searchParams.sortOrder < 3) {
        this.searchParams.searchResults = _.orderBy(this.searchParams.searchResults, ['id'], [sortOrder])
      }

      if(this.searchParams.sortOrder > 2) {
        this.searchParams.searchResults = _.orderBy(this.searchParams.searchResults, ['article_title'], [sortOrder])
      }

      if(this.showBookCover) {
        this.setupBookShelfLazyLoading()
      }
    },
    toggleBookmarkFolder(folder) {
      folder.collapsed = !folder.collapsed
      this.$root.$emit('bv::toggle::collapse', folder.id)
    },
    deleteBookmark(id) {
      const filterred = _.filter(this.bookmarks, (bm) => {
        return bm.id != id
      })

      this.bookmarks = filterred
      ipcRenderer.send('updateBookmarks', this.bookmarks);
    },
    toggleDisplayBookmarks() {
      this.displayBookmarks = !this.displayBookmarks
      if(!this.displayBookmarks) {
        _.each(this.bookmarks, (bm) => {
          if(bm.is_folder && !bm.collapsed) {
            bm.collapsed = !bm.collapsed
          }
        })
      }
    },
    deleteFolderedBookmark(folderId, bookmarkId) {
      const folder = _.find(this.bookmarks, (bm) => {
        return bm.id === folderId
      })

      const filterred = _.filter(folder.bookmarks, (bm) => {
        return bm.id != bookmarkId
      })

      folder.bookmarks = filterred
      ipcRenderer.send('updateBookmarks', this.bookmarks);
    },
    deleteFolder(id) {
      const filterred = _.filter(this.bookmarks, (bm) => {
        return bm.id != id
      })

      this.bookmarks = filterred
      ipcRenderer.send('updateBookmarks', this.bookmarks);
    },
    setupBookShelfLazyLoading() {
      if(this.searchParams.searchResultCount > 0) {
        _.delay(function(){
          let searchResultThumbs = document.querySelectorAll('.sr-lazy-thumb');
          if (window.searchResultThumbObserver && window.searchResultThumbObserver.observer) {
            window.searchResultThumbObserver.observer.disconnect();
            delete window.searchResultThumbObserver;
          }

          for (let i = 0, len = searchResultThumbs.length; i < len; i++) {
            searchResultThumbs[i].removeAttribute('src');
            searchResultThumbs[i].setAttribute('data-loaded', false);
          }

          window.searchResultThumbObserver = lozad(searchResultThumbs);
          window.searchResultThumbObserver.observe();
        }, 100)
      } else {
        _.delay(function(){
          let bookShelfThumbs = document.querySelectorAll('.bs-lazy-thumb');
          if (window.bookShelfThumbObserver && window.bookShelfThumbObserver.observer) {
            console.log('reset lazy loading')
            window.bookShelfThumbObserver.observer.disconnect();
            delete window.bookShelfThumbObserver;
          }

          for (let i = 0, len = bookShelfThumbs.length; i < len; i++) {
            bookShelfThumbs[i].removeAttribute('src');
            bookShelfThumbs[i].setAttribute('data-loaded', false);
          }

          window.bookShelfThumbObserver = lozad(bookShelfThumbs);
          window.bookShelfThumbObserver.observe();
        }, 100)
      }
    },
  },
  mounted: function() {
    console.log('Mounted [Home]');
    ipcRenderer.send('getBookmarks');
    if(this.bookmarks.length == 0) {
      ipcRenderer.on('acceptBookmarks', (event, data) => {
        this.bookmarks = data;
      })
    }

    if(this.config.sortOrderIssues > 1) {
      this.toggleSortOrderIssues()
    }

    this.setupBookShelfLazyLoading()

    ipcRenderer.on('fullTextSearchResults', (event, data) => {
      _.each(data, (d) => {
        const issueId = d.issue
        const issue = _.find(this.issues, (i) => {
          return i.id == issueId
        })
        d.issue_year = issue.year
        d.issue_month = issue.month
      })

      const sortOrder = (this.searchParams.sortOrder % 2 === 0) ? 'asc' : 'desc',
        startYear =  parseInt(this.searchParams.startYear),
        endYear =  parseInt(this.searchParams.endYear)

      const searchResults = _.filter(data, (d) => {
        return d.issue_year >= startYear && d.issue_year <= endYear
      })

      if(this.searchParams.sortOrder < 3) {
        this.searchParams.searchResults = _.orderBy(searchResults, ['id'], [sortOrder])
      }

      if(this.searchParams.sortOrder > 2) {
        this.searchParams.searchResults = _.orderBy(searchResults, ['article_title'], [sortOrder])
      }

      this.searchParams.searchResultCount = this.searchParams.searchResults.length
    })
  },
};
const EbookViewer = {
  template: '#ebook-viewer',
  data: () => {
    return {
      issues,
      issue: null,
      ebook: null,
      currentPage: 1,
      ebookPageCount: 0,
      pageScale: 0.75,
      singlePage: true,
      pageDisplay: "1",
      pageViewerWidth: 0,
      pageContentWidth: 0,
      pageFlipDirection: 1,
      pagePreviewEnabled: false,
      searchParams,
      pageRendering: true,
      issueSearchTerm: null,
      issueHighlightTerm: null,
      displayTOC: false,
      fullscreenMode: false,
      bookmarks: [],
      displayBookmarks: false,
      askForBookmarkFolderName: false,
      bookmarkFolderName: null,
      selectedPage: 1,
      pageSelectOptions: [
        { "value": 1, "text": "Cover 1" },
        { "value": 2, "text": "Cover 2" }
      ],
      viewerCanvasRatio: 0
    }
  },
  created: function () {
    this.currentPage = this.$route.params.page
    if(this.searchParams.searchTerm) {
      const searchParamsValueCopy = JSON.parse(JSON.stringify(this.searchParams))
      this.issueSearchTerm = searchParamsValueCopy.searchTerm
      this.issueHighlightTerm = this.issueSearchTerm.toUpperCase().split(' ')
    }
    this.getIssue()
  },
  computed: {
    singlePageView() {
      return this.singlePage
    },
    disableDoubleViewButton() {
      return !this.singlePage || (this.currentPage == 1) || (this.currentPage == this.ebookPageCount)
    },
    doublePageView() {
      return !this.singlePage
    },
    issueHasNoAttachment() {
        return !(this.issue.hasAttachment === 1)
    },
    flexJustifyContentStart() {
      return this.pageContentWidth > this.pageViewerWidth
    },
    showPagePreview() {
      return this.pagePreviewEnabled
    },
    isPageRendering() {
      return this.pageRendering
    },
    displayTOC() {
      return this.displayTOC
    },
    isFullscreenMode() {
      return this.fullscreenMode
    },
    isFirstPage() {
      return this.currentPage === 1
    },
    isLastPage() {
      if (this.singlePage) {
        return this.currentPage === this.ebookPageCount
      } else {
        return this.currentPage === (this.ebookPageCount - 1)
      }
    },
    isFitWidth() {
      return !(this.pageScale < 2)
    },
    isFitScreen() {
      return !(this.viewerCanvasRatio > 1 || this.viewerCanvasRatio < 0.9) && !this.pageRendering
    },
    isZoomOut() {
      return !(this.pageScale > 0.75)
    },
    isZoomIn() {
      return !(this.pageScale < 2)
    }
  },
  watch: {
    issueSearchTerm(value) {
      if(value === '' || value === null) {
        this.issueHighlightTerm = null
        this.getPage(this.ebook, this.currentPage)
      }
    },
    selectedPage(value) {
      if (this.currentPage != value) {
        if(value === 1 || value === this.ebookPageCount) {
          this.pageFlipDirection = value === 1 ? 1 : 2
          if(!this.singlePage) {
            this.singlePage = !this.singlePage;
          }
        } else if(this.doublePageView) {
          if(value % 2 != 0) {
            value = value - 1
          }
        }

        this.currentPage = value
        this.selectedPage = this.currentPage
        this.getPage(this.ebook, this.currentPage)
      }
    }
  },
  methods: {
    getIssue() {
      this.issue = _.find(this.issues, (i) => {
        return i.id === this.$route.params.id
      })
    },
    getPage(d, p) {
      const pageViewer = document.querySelector("#page-viewer");

      this.pageViewerWidth = pageViewer.clientWidth
      this.pageDisplay = this.currentPage
      this.pageRendering = true

      d.getPage(p).then((page) => {
        let viewport = page.getViewport(this.pageScale),
          leftPageTextLayer = document.getElementById('left-page-text-layer'),
          canvas = document.querySelector('.left-page.preload'),
          activeCanvas = document.querySelector('.left-page.active'),
          context = canvas.getContext('2d'),
          renderContext = {
            canvasContext: context,
            viewport: viewport,
          }

        canvas.height = viewport.height
        canvas.width = viewport.width
        this.pageContentWidth = viewport.width

        canvas.classList.add("active")
        canvas.classList.remove("preload")
        activeCanvas.classList.add("preload")
        activeCanvas.classList.remove("active")

        page.render(renderContext).then(() => {
          return page.getTextContent();
        }).then((textContent) => {
          while (leftPageTextLayer.lastChild) {
            leftPageTextLayer.removeChild(leftPageTextLayer.lastChild);
          }

          const textLayer =  pdfjs.renderTextLayer({
            textContent: textContent,
            container: leftPageTextLayer,
            viewport: viewport,
            enhanceTextSelection: true
          });

          _.delay(() => {
            for(let textItem = leftPageTextLayer.firstChild; textItem != null; textItem = textItem.nextSibling) {
              let textContent = textItem.textContent
              
              if (this.issueHighlightTerm != null) {
                if (this.containsAny(this.issueHighlightTerm, textContent.toUpperCase())) {
                  for (const highlightTerm of this.issueHighlightTerm) {
                    const termIndex = textContent.toUpperCase().indexOf(highlightTerm);
  
                    if (termIndex >= 0) {
                      const termLength = highlightTerm.length
                      textContent = textContent.substring(0, termIndex) +
                        '<span class="search-term-highlight">' +
                        textContent.substring(termIndex, termIndex + termLength) +
                        '</span>' + textContent.substring(termIndex + termLength);
                    }
                  }

                  textItem.innerHTML = textContent;
                }
              }
            }
          }, 100)

          if (this.singlePageView) {
            this.pageRendering = false
          }
        });

        const pageViewer = document.getElementById('page-viewer')
        activeCanvas = document.querySelector('.left-page.active')
        this.viewerCanvasRatio = activeCanvas.offsetHeight / pageViewer.offsetHeight
      })

      if (this.singlePageView) {
        this.preloadPage((this.pageFlipDirection === 1) ? (p + 1) : (p - 1))
      }

      if (this.doublePageView) {
        this.pageDisplay = this.currentPage + "-" + (this.currentPage + 1)

        d.getPage(p + 1).then((page) => {
          let viewport = page.getViewport(this.pageScale),
            rightPageTextLayer = document.getElementById('right-page-text-layer'),
            canvas = document.querySelector('.right-page.preload'),
            activeCanvas = document.querySelector('.right-page.active'),
            context = canvas.getContext('2d'),
            renderContext = {
              canvasContext: context,
              viewport: viewport,
            }

          canvas.height = viewport.height
          canvas.width = viewport.width
          this.pageContentWidth += viewport.width

          canvas.classList.add("active")
          canvas.classList.remove("preload")
          activeCanvas.classList.add("preload")
          activeCanvas.classList.remove("active")

          page.render(renderContext).then(() => {
            return page.getTextContent();
          }).then((textContent) => {
            while (rightPageTextLayer.lastChild) {
              rightPageTextLayer.removeChild(rightPageTextLayer.lastChild);
            }

            const textLayer =  pdfjs.renderTextLayer({
              textContent: textContent,
              container: rightPageTextLayer,
              viewport: viewport,
              enhanceTextSelection: true
            });
            
            _.delay(() => {
              for(let textItem = rightPageTextLayer.firstChild; textItem != null; textItem = textItem.nextSibling) {
                let textContent = textItem.textContent
                
                if (this.issueHighlightTerm != null) {
                  if (this.containsAny(this.issueHighlightTerm, textContent.toUpperCase())) {
                    for (const highlightTerm of this.issueHighlightTerm) {
                      const termIndex = textContent.toUpperCase().indexOf(highlightTerm);
    
                      if (termIndex >= 0) {
                        const termLength = highlightTerm.length
                        textContent = textContent.substring(0, termIndex) +
                          '<span class="search-term-highlight">' +
                          textContent.substring(termIndex, termIndex + termLength) +
                          '</span>' + textContent.substring(termIndex + termLength);
                      }
                    }
  
                    textItem.innerHTML = textContent;
                  }
                }
              }
            }, 100)

            this.pageRendering = false
          });
        })

        this.preloadPage((this.pageFlipDirection === 1) ? (p + 2) : (p - 1))
      }

      this.preloadPrintPage(p)
      if (this.showPagePreview) {
        const thumbnailId = this.generateThumbnailId(this.issue.id, p)
        const thumb = document.getElementById(thumbnailId)
        thumb.scrollIntoView()
      }
    },
    preloadPage(p) {
      this.ebook.getPage(p).then((page) => {
        let viewport = page.getViewport(this.pageScale),
          canvas = document.querySelector('.left-preload-page'),
          context = canvas.getContext('2d'),
          renderContext = {
            canvasContext: context,
            viewport: viewport,
          }

        canvas.height = viewport.height
        canvas.width = viewport.width

        page.render(renderContext)
      })
      
      if (this.singlePageView && this.currentPage === 1) {
        this.ebook.getPage(this.ebookPageCount).then((page) => {
          let viewport = page.getViewport(this.pageScale),
            canvas = document.querySelector('.right-preload-page'),
            context = canvas.getContext('2d'),
            renderContext = {
              canvasContext: context,
              viewport: viewport,
            }
  
          canvas.height = viewport.height
          canvas.width = viewport.width
  
          page.render(renderContext)
        })
      } else if (this.doublePageView) {
        this.ebook.getPage(p+1).then((page) => {
          let viewport = page.getViewport(this.pageScale),
            canvas = document.querySelector('.right-preload-page'),
            context = canvas.getContext('2d'),
            renderContext = {
              canvasContext: context,
              viewport: viewport,
            }
  
          canvas.height = viewport.height
          canvas.width = viewport.width
  
          page.render(renderContext)
        })
      }
    },
    preloadPrintPage(p) {
      this.ebook.getPage(p).then((page) => {
        let viewport1 = page.getViewport(2.0),
          canvas1 = document.getElementById('print-page-one'),
          context1 = canvas1.getContext('2d'),
          renderContext1 = {
            canvasContext: context1,
            viewport: viewport1,
          }

        canvas1.height = viewport1.height
        canvas1.width = viewport1.width

        page.render(renderContext1)

        if (this.doublePageView) {
          this.ebook.getPage(p+1).then((page) => {
            let viewport2 = page.getViewport(2.0),
              canvas2 = document.getElementById('print-page-two'),
              context2 = canvas2.getContext('2d'),
              renderContext2 = {
                canvasContext: context2,
                viewport: viewport2,
              }

            canvas2.height = viewport2.height
            canvas2.width = viewport2.width

            page.render(renderContext2)
          })
        }
      })
    },
    previousPage: _.debounce(function() {
      if (this.currentPage > 1) {
        this.pageFlipDirection = 2
        let expectedNewPage = this.currentPage - 1

        if(this.doublePageView && (expectedNewPage > 1)) {
          expectedNewPage -= 1
        }

        this.currentPage = expectedNewPage

        if(this.currentPage == 1 && !this.singlePage) {
          this.singlePage = !this.singlePage;
        }

        this.selectedPage = this.currentPage
        this.getPage(this.ebook, this.currentPage)
        this.$root.$emit('bv::hide::tooltip')
      }
    }, 250, {
      'leading': true,
      'trailing': false
    }),
    nextPage: _.debounce(function() {
      if (this.currentPage < this.ebookPageCount) {
        this.pageFlipDirection = 1
        let expectedNewPage = this.currentPage + 1
        if(this.doublePageView && (expectedNewPage == this.ebookPageCount)) {
          expectedNewPage -= 1
        } else if(this.doublePageView && (expectedNewPage < this.ebookPageCount)) {
          expectedNewPage += 1
        }

        if(this.currentPage != expectedNewPage) {
          this.currentPage = expectedNewPage
          this.selectedPage = this.currentPage

          if(this.currentPage == this.ebookPageCount && !this.singlePage) {
            this.singlePage = !this.singlePage;
          }

          this.getPage(this.ebook, this.currentPage)
          this.$root.$emit('bv::hide::tooltip')
        }
      }
    }, 250, {
      'leading': true,
      'trailing': false
    }),
    firstPage() {
      if(this.currentPage != 1) {
        this.currentPage = 1
        this.pageFlipDirection = 1
        if(!this.singlePage) {
          this.singlePage = !this.singlePage;
        }
        this.selectedPage = this.currentPage
        this.getPage(this.ebook, this.currentPage)
        this.$root.$emit('bv::hide::tooltip')
      }
    },
    lastPage() {
      if(this.currentPage != this.ebookPageCount) {
        this.currentPage = this.ebookPageCount
        this.pageFlipDirection = 2
        if(!this.singlePage) {
          this.singlePage = !this.singlePage;
        }
        this.selectedPage = this.currentPage
        this.getPage(this.ebook, this.currentPage)
        this.$root.$emit('bv::hide::tooltip')
      }
    },
    printPDF() {
      const leftPage = document.getElementById('print-page-one');
      const leftPageData = leftPage.toDataURL('image/jpeg', 1.0);
      let pages = [
        {
          data: leftPageData
        }
      ]

      if (this.doublePageView) {
        const rightPage = document.getElementById('print-page-two');
        const rightPageData = rightPage.toDataURL('image/jpeg', 1.0);
        pages.push({
          data: rightPageData
        })
      }

      ipcRenderer.send('printCanvas', {
        pages:pages
      });
    },
    viewAttachment(filename) {
      this.$root.$emit('bv::hide::tooltip')
      ipcRenderer.send('openAttachment', filename);
    },
    zoomIn: _.debounce(function() {
      if (this.pageScale < 2) {
        this.$root.$emit('bv::hide::tooltip')
        this.pageScale += 0.25
        this.getPage(this.ebook, this.currentPage)
      }
    }, 250, {
      'leading': true,
      'trailing': false
    }),
    zoomOut: _.debounce(function() {
      if (this.pageScale > 0.75) {
        this.$root.$emit('bv::hide::tooltip')
        this.pageScale -= 0.25
        this.getPage(this.ebook, this.currentPage)
      }
    }, 250, {
      'leading': true,
      'trailing': false
    }),
    togglePageViewDisplay() {
      if(this.currentPage != 1 || this.currentPage != this.ebookPageCount) {
        this.singlePage = !this.singlePage;
        if(this.currentPage % 2 != 0) {
          this.currentPage = this.currentPage - 1
          this.selectedPage = this.currentPage
        }
        this.getPage(this.ebook, this.currentPage)
      }
      this.$root.$emit('bv::hide::tooltip')
    },
    showBookmarksModal() {
      this.$refs.bookmarksRef.show()
    },

    showAboutModal() {
      this.$refs.aboutRef.show()
    },
    showHelpModal() {
      this.$refs.helpRef.show()
    },
    togglePagePreview() {
      this.pagePreviewEnabled = !this.pagePreviewEnabled
      if (this.pagePreviewEnabled) {
        _.delay(() => {
          const thumbnailId = this.generateThumbnailId(this.issue.id, this.currentPage)
          const thumb = document.getElementById(thumbnailId)
          thumb.scrollIntoView()
        }, 250)
      }
    },
    getPagePreview(issue, page) {
      const issueNumber = _.padStart(issue, 4, '0'),
        pageNumber = _.padStart(page, 4, '0')

      return "assets/thumbs/" + issueNumber + "/" + issueNumber + ".pdf_" + pageNumber + ".jpg"
    },
    gotoPage: _.debounce(function(p) {
      if(this.displayTOC) {
        this.displayTOC = !this.displayTOC
      }

      if (this.currentPage != p) {
        if(p === 1 || p === this.ebookPageCount) {
          this.pageFlipDirection = p === 1 ? 1 : 2
          if(!this.singlePage) {
            this.singlePage = !this.singlePage;
          }
        } else if(this.doublePageView) {
          if(p % 2 != 0) {
            p = p - 1
          }
        }

        this.currentPage = p
        this.selectedPage = this.currentPage
        this.getPage(this.ebook, this.currentPage)
      }
    }, 250, {
      'leading': true,
      'trailing': false
    }),
    isCurrentPage(p) {
      return this.currentPage === p
    },
    zoomFitWidth() {
      this.ebook.getPage(this.currentPage).then((page) => {
        const pageViewer = document.getElementById('page-viewer'),
          viewport = page.getViewport(1.0)

        this.$root.$emit('bv::hide::tooltip')
        this.pageScale = pageViewer.offsetWidth / viewport.width
        this.getPage(this.ebook, this.currentPage)
      })
    },
    zoomFitScreen: _.debounce(function() {
      this.ebook.getPage(this.currentPage).then((page) => {
        const pageViewer = document.getElementById('page-viewer'),
          viewport = page.getViewport(1.0)

        this.$root.$emit('bv::hide::tooltip')
        this.pageScale = pageViewer.offsetHeight / viewport.height
        this.getPage(this.ebook, this.currentPage)
      })
    }, 2000, {
      'leading': true,
      'trailing': false
    }),
    containsAny(needles, haystack) {
      const filtered = _.filter(needles, (n) => {
        return haystack.includes(n)
      })

      return (filtered.length > 0)
    },
    doFind: _.debounce(function() {
      this.issueSearchTerm = _.trim(this.issueSearchTerm)
      this.issueHighlightTerm = this.issueSearchTerm.toUpperCase().split(' ')
      this.getPage(this.ebook, this.currentPage)
    }, 2000, {
      'leading': true,
      'trailing': false
    }),
    toggleTOCDisplay() {

      if(this.displayBookmarks){
        this.displayBookmarks = !this.displayBookmarks
      }
      this.displayTOC = !this.displayTOC
    },
    toggleFullscreenMode() {
      this.fullscreenMode = !this.fullscreenMode
    },
    toggleBookmarkFolder(folder) {
      folder.collapsed = !folder.collapsed
      this.$root.$emit('bv::toggle::collapse', folder.id)
    },
    addBookmark() {
      const bookmarkId = 'BM' + _.padStart(this.issue.id, 4, '0') + _.padStart(this.currentPage, 4, '0');
      const duplicate = _.find(this.bookmarks, (bm) => {
        return bm.id === bookmarkId
      })

      if (_.isUndefined(duplicate)) {
        const bookmark = {
          id: bookmarkId,
          tag: 'Issue #' + this.issue.id + ', p.' + this.currentPage,
          is_folder: false,
          issue: this.issue.id,
          page: this.currentPage,
        }

        this.bookmarks.push(bookmark)
        ipcRenderer.send('updateBookmarks', this.bookmarks);
      }
    },
    deleteBookmark(id) {
      const filterred = _.filter(this.bookmarks, (bm) => {
        return bm.id != id
      })

      this.bookmarks = filterred
      ipcRenderer.send('updateBookmarks', this.bookmarks);
    },
    toggleDisplayBookmarks() {
      if(this.displayTOC) {
        this.displayTOC = !this.displayTOC
      }
      this.displayBookmarks = !this.displayBookmarks
      if(!this.displayBookmarks) {
        _.each(this.bookmarks, (bm) => {
          if(bm.is_folder && !bm.collapsed) {
            bm.collapsed = !bm.collapsed
          }
        })
      }
    },
    toggleBookmarkFolderForm() {
      this.askForBookmarkFolderName = !this.askForBookmarkFolderName
    },
    createBookmarkFolder() {
      this.bookmarkFolderName = _.trim(this.bookmarkFolderName)
      if (this.bookmarkFolderName != '' && this.bookmarkFolderName != null) {
        const folderId = 'FLDR' + _.now()
        const duplicate = _.find(this.bookmarks, (bm) => {
          return (bm.is_folder === true && bm.tag === this.bookmarkFolderName)
        })

        if (_.isUndefined(duplicate)) {
          const bookmark = {
            id: folderId,
            tag: this.bookmarkFolderName,
            is_folder: true,
            collapsed: true,
            bookmarks: []
          }

          this.bookmarks.push(bookmark)
          ipcRenderer.send('updateBookmarks', this.bookmarks)
          this.bookmarkFolderName = null
          this.toggleBookmarkFolderForm()
        }
      }
    },
    addFolderedBookmark(folderId) {
      const bookmarkId = 'BM' + _.padStart(this.issue.id, 4, '0') + _.padStart(this.currentPage, 4, '0');
      let openFolderAfterAdd = true

      const folder = _.find(this.bookmarks, (bm) => {
        return bm.id === folderId
      })

      const duplicate = _.find(folder.bookmarks, (bm) => {
        return bm.id === bookmarkId
      })

      if (_.isUndefined(duplicate)) {
        if(!folder.collapsed) {
          folder.collapsed = true
          openFolderAfterAdd = false
        }
        const bookmark = {
          id: bookmarkId,
          tag: 'Issue #' + this.issue.id + ', p.' + this.currentPage,
          is_folder: false,
          issue: this.issue.id,
          page: this.currentPage,
        }

        folder.bookmarks.push(bookmark)
        ipcRenderer.send('updateBookmarks', this.bookmarks);
        if(!openFolderAfterAdd) {
          folder.collapsed = false
        }

        if(folder.collapsed) {
          _.delay(() => {
            this.toggleBookmarkFolder(folder)
          }, 250)
        }
      }
    },
    deleteFolderedBookmark(folderId, bookmarkId) {
      const folder = _.find(this.bookmarks, (bm) => {
        return bm.id === folderId
      })

      const filterred = _.filter(folder.bookmarks, (bm) => {
        return bm.id != bookmarkId
      })

      folder.bookmarks = filterred
      ipcRenderer.send('updateBookmarks', this.bookmarks);
    },
    deleteFolder(id) {
      const filterred = _.filter(this.bookmarks, (bm) => {
        return bm.id != id
      })

      this.bookmarks = filterred
      ipcRenderer.send('updateBookmarks', this.bookmarks);
    },
    generateThumbnailId(issue, page) {
      const issueNumber = _.padStart(issue, 4, '0'),
        pageNumber = _.padStart(page, 4, '0')

      return issueNumber + pageNumber
    },
  },
  mounted: function () {
    console.log('Mounted [EbookViewer]');
    let additionalPageSelectOptions = _.times(this.issue.pageCount - 2, (n) => {
      return {
        "value": n + 3,
        "text": "Page " + (n + 1)
      }
    })

    this.pageSelectOptions = _.concat(this.pageSelectOptions, additionalPageSelectOptions)
    this.pageSelectOptions[this.issue.pageCount - 2].text = "Cover 3"
    this.pageSelectOptions[this.issue.pageCount - 1].text = "Cover 4"
    
    const loadingTask = pdfjs.getDocument({
      url: "./assets/ebooks/" + this.issue.filename,
      disableFontFace: false,
      password: "M3r3d1th"
    })

    const pageViewer = document.querySelector("#page-viewer");
    this.pageViewerWidth = pageViewer.clientWidth

    this.selectedPage = this.currentPage
    loadingTask.promise.then((doc) => {
      this.ebook = doc
      this.ebookPageCount = doc.numPages
      this.getPage(this.ebook, this.currentPage)
    })

    ipcRenderer.send('getBookmarks');
    ipcRenderer.on('acceptBookmarks', (event, data) => {
      this.bookmarks = data;
    })

    ipcRenderer.on('bookmarksUpdated', (event, data) => {
      console.log(data)
    })
  },
};

const aboutViewer = {

  template: '#about-viewer',

  methods: {

  },

};

const helpViewer = {

  template: '#help-viewer',
  data: () => {
    return {
      issues,
      issue: null,
      ebook: null,
      ebookPageCount: 0,
      currentPage: 1,
      pageScale: 1,
      singlePage: true,
      pageViewerWidth: 0,
      pageContentWidth: 0,
    }
  },
  computed: {
    singlePageView() {
      return this.singlePage
    },
    flexJustifyContentStart() {
      return this.pageContentWidth > this.pageViewerWidth
    },
    isFirstPage() {
      return this.currentPage === 1
    },
    isLastPage() {
      if (this.singlePage) {
        return this.currentPage === this.ebookPageCount
      } else {
        return this.currentPage === (this.ebookPageCount - 1)
      }
    },
  },
  methods: {
    getIssue() {
      this.issue = _.find(this.issues, (i) => {
        return i.id === this.$route.params.id
      })
    },
    getPage(d, p) {
      const pageViewer = document.querySelector("#page-viewer");
      this.pageViewerWidth = pageViewer.clientWidth
      this.pageDisplay = this.currentPage
      d.getPage(p).then((page) => {
        let viewport = page.getViewport(this.pageScale),
          leftPageTextLayer = document.getElementById('left-page-text-layer'),
          canvas = document.getElementById('left-page'),
          context = canvas.getContext('2d'),
          renderContext = {
            canvasContext: context,
            viewport: viewport,
          }

        canvas.height = viewport.height
        canvas.width = viewport.width
        this.pageContentWidth = viewport.width

        page.render(renderContext).then(function () {
          return page.getTextContent();
        }).then(function (textContent) {
          while (leftPageTextLayer.lastChild) {
            leftPageTextLayer.removeChild(leftPageTextLayer.lastChild);
          }

          const textLayer =  pdfjs.renderTextLayer({
            textContent: textContent,
            container: leftPageTextLayer,
            viewport: viewport,
            enhanceTextSelection: true
          });
        });
      })

      if (this.doublePageView) {
        this.pageDisplay = this.currentPage + "-" + (this.currentPage + 1)

        d.getPage(p + 1).then((page) => {
          let viewport = page.getViewport(this.pageScale),
            canvas = document.getElementById('right-page'),
            rightPageTextLayer = document.getElementById('right-page-text-layer'),
            context = canvas.getContext('2d'),
            renderContext = {
              canvasContext: context,
              viewport: viewport,
            }

          canvas.height = viewport.height
          canvas.width = viewport.width
          this.pageContentWidth += viewport.width

          page.render(renderContext).then(function () {
            return page.getTextContent();
          }).then(function (textContent) {
            while (rightPageTextLayer.lastChild) {
              rightPageTextLayer.removeChild(rightPageTextLayer.lastChild);
            }

            const textLayer =  pdfjs.renderTextLayer({
              textContent: textContent,
              container: rightPageTextLayer,
              viewport: viewport,
              enhanceTextSelection: true
            });
          });

          this.preloadPage((this.pageFlipDirection === 1) ? (p + 2) : (p - 1))
        })
      }
    },
    preloadPage(p) {
      this.ebook.getPage(p).then((page) => {
        let viewport = page.getViewport(this.pageScale),
          canvas = document.getElementById('preload-page'),
          context = canvas.getContext('2d'),
          renderContext = {
            canvasContext: context,
            viewport: viewport,
          }

        canvas.height = viewport.height
        canvas.width = viewport.width

        page.render(renderContext)
      })
    },
    previousPage() {
      if (this.currentPage > 1) {
        this.pageFlipDirection = 2
        this.currentPage -= 1
        this.getPage(this.ebook, this.currentPage)
        this.$root.$emit('bv::hide::tooltip')
      }
    },
    nextPage() {
      if ((this.currentPage + (this.singlePage ? 0 : 1)) < this.ebookPageCount) {
        this.pageFlipDirection = 1
        this.currentPage += 1
        this.getPage(this.ebook, this.currentPage)
        this.$root.$emit('bv::hide::tooltip')
      }
    },
    firstPage() {
      this.currentPage = 1
      this.pageFlipDirection = 1
      this.getPage(this.ebook, this.currentPage)
      this.$root.$emit('bv::hide::tooltip')
    },
    lastPage() {
      this.currentPage = this.singlePage ? this.ebookPageCount : (this.ebookPageCount - 1)
      this.pageFlipDirection = 2
      this.getPage(this.ebook, this.currentPage)
      this.$root.$emit('bv::hide::tooltip')
    },
    printPDF() {
      ipcRenderer.send('printHelpAttachment');
    },
    gotoPage(p) {
      this.currentPage = p
      this.getPage(this.ebook, this.currentPage)
    },
    isCurrentPage(p) {
      return this.currentPage === p
    },
  },

  mounted: function () {
    console.log('Mounted [HelpViewer]');
    const loadingTask = pdfjs.getDocument({
      url: "./assets/help/Help-Archive.pdf",
      disableFontFace: false
    })

    const pageViewer = document.querySelector("#page-viewer");
    this.pageViewerWidth = pageViewer.clientWidth

    loadingTask.promise.then((doc) => {
      this.ebook = doc
      this.ebookPageCount = doc.numPages
      this.preloadPage(this.ebookPageCount)
      this.getPage(this.ebook, this.currentPage)
    })
  },
};

const EbookBMLoader = {
  created: function() {
    this.$router.push({ name: 'ebook-viewer', params: { id: this.$route.params.id, page: this.$route.params.page } })
  },
};

const SplashScreen = {
  template: '#splashscreen',
  mounted: function() {
    _.delay(() => {
      router.replace('/home');
    }, 3000)
  },
};

const routes = [{
    path: '/home',
    name: 'home',
    component: Home,
    props: {

    },
  },
  {
    path: '/ebook-viewer/:id/:page',
    name: 'ebook-viewer',
    component: EbookViewer,
    props: {

    },
  },
  {
    path: '/ebook-bm-loader/:id/:page',
    name: 'ebook-bm-loader',
    component: EbookBMLoader,
  },
  {
    path: '/about-viewer',
    name: 'about-viewer',
    component: aboutViewer,
    props: {

    },
  },
  {
    path: '/help-viewer',
    name: 'help-viewer',
    component: helpViewer,
    props: {

    },
  },
  {
    path: '/splashscreen',
    name: 'splashscreen',
    component: SplashScreen,
    props: {

    },
  },
];

const router = new VueRouter({
  routes,
});

Vue.set(Vue.prototype, '_', _);

new Vue({
  data: {
  },
  router,
}).$mount('#app');

router.replace('/splashscreen');