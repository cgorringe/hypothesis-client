import Sidebar from './sidebar';

/**
 * @typedef {import('../types/annotator').HypothesisWindow} HypothesisWindow
 */

const defaultConfig = {
  TextSelection: {},
  PDF: {},
  BucketBar: {
    container: '.annotator-frame',
    scrollables: ['#viewerContainer'],
  },
  Toolbar: {
    container: '.annotator-frame',
  },
};

// In accordance with the minimum width PDFJS asserts for its #mainContainer
// element, we shouldn't try to shrink down the PDF container any narrower
// than this value when resizing it in side-by-side mode. If the available space
// left in the viewport after alloting space for the sidebar is less than this
// value, don't apply side-by-side mode, but instead allow the sidebar to
// overlap the PDF
const MIN_PDF_WIDTH = 320;

export default class PdfSidebar extends Sidebar {
  constructor(element, config) {
    super(element, { ...defaultConfig, ...config });

    this.lastSidebarLayoutState = {
      expanded: false,
      width: 0,
      height: 0,
    };

    this.window = /** @type {HypothesisWindow} */ (window);
    this.pdfViewer = this.window.PDFViewerApplication?.pdfViewer;
    this.pdfContainer = this.window.PDFViewerApplication?.appConfig?.appContainer;

    // Prefer to lay out the sidebar and the PDF side-by-side (with the sidebar
    // not overlapping the PDF) when space allows
    this.sideBySide =
      config.enableExperimentalPDFSideBySide &&
      this.pdfViewer &&
      this.pdfContainer;

    // Is the current state of the layout side-by-side?
    this.sideBySideActive = false;

    if (this.sideBySide) {
      this.subscribe('sidebarLayoutChanged', state =>
        this.fitSideBySide(state)
      );
      window.addEventListener('resize', () => this.fitSideBySide());
    }
  }

  /**
   * Override `Guest.onElementClick` to prevent the sidebar from being
   * hidden on document clicks if in side-by-side layout
   */
  onElementClick(event) {
    if (this.sideBySideActive) {
      // Don't hide the sidebar if it is side-by-side with the PDF
      return;
    }
    if (!this.isEventInAnnotator(event) && !this.selectedTargets?.length) {
      this.crossframe?.call('hideSidebar');
    }
  }

  /**
   * Override `Guest.onElementTouchStart`
   */
  onElementTouchStart(event) {
    this.onElementClick(event);
  }

  /**
   * Attempt to make the PDF viewer and the sidebar fit side-by-side without
   * overlap if there is enough room in the viewport to do so reasonably.
   * Resize the PDF viewer container element to leave the right amount of room
   * for the sidebar, and prompt PDFJS to re-render the PDF pages to scale
   * within that resized container.
   */
  fitSideBySide(sidebarLayoutState) {
    if (!sidebarLayoutState) {
      sidebarLayoutState = this.lastLayoutState;
    }
    if (this.pdfContainer) {
      const maximumWidthToFit =
        this.window.innerWidth - sidebarLayoutState.width;
      if (maximumWidthToFit <= MIN_PDF_WIDTH) {
        this.sideBySideActive = false;
        this.pdfContainer.style.width = 'auto';
      } else {
        this.sideBySideActive = true;
        this.pdfContainer.style.width = maximumWidthToFit + 'px';
      }
      // From PDFJS `webViewerResize`
      const currentScaleValue = this.pdfViewer.currentScaleValue;
      if (
        currentScaleValue === 'auto' ||
        currentScaleValue === 'page-fit' ||
        currentScaleValue === 'page-width'
      ) {
        // NB: There is logic within the setter for `currentScaleValue`
        this.pdfViewer.currentScaleValue = currentScaleValue;
      }
      this.pdfViewer.update();
    }

    this.lastLayoutState = sidebarLayoutState;
  }
}
