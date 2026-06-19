// ============================================
// FoxiMed — Medical Calculator PWA
// © 2026 Mohammad Mahdi Taghavi. All rights reserved.
//
// License: CC BY-NC 4.0
// You may share and adapt this work for non-commercial purposes
// with appropriate credit. Commercial use is prohibited.
// https://creativecommons.org/licenses/by-nc/4.0/
//
// Contact: https://t.me/i_2mt
// ============================================

// ============================================
// APP STATE & CONFIGURATION
// ============================================
const AppState = {
    selectedDrug: 'heparin',
    infusionMethod: 'syringe',
    solutionVolume: 50,
    ampouleCount: 2,
    customDrugAmount: null,
    useCustomDrugAmount: false,
    desiredDose: '',
    patientWeight: '',
    useWeight: false,
    currentAmpouleIndex: 0,
    theme: 'light',
    currentTab: 'calculator',
    calculationsToday: 0,
    customVolume: false,
    pwaInstallPrompt: null,
    settings: {
        darkMode: false,
        largeFont: false,
        doseAlerts: true,
        compatAlerts: true,
        saveHistory: true,
        hapticFeedback: true,
        colorTheme: 'fox',
        themeMode: 'light'
    },
    reverseMode: false
};

// ============================================
// LOADING SCREEN
// ============================================
(function setupLoadingScreen() {
    const steps = [
        { status: 'در حال بارگذاری پایگاه داده دارویی...', pct: 20 },
        { status: 'در حال راه‌اندازی ماشین حساب...', pct: 50 },
        { status: 'در حال اعمال تنظیمات...', pct: 75 },
        { status: 'آماده است!', pct: 100 }
    ];
    function applyThemeToLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (!loadingScreen) return;

    // Get saved settings
    let colorTheme = 'default';
    let isDark = false; // default to light
    try {
        const savedSettings = localStorage.getItem('appSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            colorTheme = settings.colorTheme || 'default';
            const themeMode = settings.themeMode || 'light';
            // Determine if dark mode should be active (honor auto)
            if (themeMode === 'dark') isDark = true;
            else if (themeMode === 'auto') {
                isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            } else {
                isDark = false;
            }
        } else {
            // Fallback: check legacy theme
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme === 'dark') isDark = true;
        }
    } catch(e) { /* ignore */ }

    // Define theme gradients (same as in THEMES object but simplified for loading)
    const themeGradients = {
        default: { light: 'linear-gradient(145deg, #667eea 0%, #764ba2 100%)', dark: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)' },
        fox:     { light: 'linear-gradient(145deg, #f97316 0%, #dc2626 100%)', dark: 'linear-gradient(145deg, #2d1a11 0%, #1f0f0a 100%)' },
        ocean:   { light: 'linear-gradient(145deg, #0ea5e9 0%, #0d9488 100%)', dark: 'linear-gradient(145deg, #0c4a6e 0%, #0f3a3a 100%)' },
        rose:    { light: 'linear-gradient(145deg, #f43f5e 0%, #ec4899 100%)', dark: 'linear-gradient(145deg, #2d1321 0%, #1f0f18 100%)' },
        forest:  { light: 'linear-gradient(145deg, #22c55e 0%, #14b8a6 100%)', dark: 'linear-gradient(145deg, #14532d 0%, #115e59 100%)' }
    };

    const fallbackLight = 'linear-gradient(145deg, #667eea 0%, #764ba2 100%)';
    const fallbackDark  = 'linear-gradient(145deg, #1f2937 0%, #111827 100%)';

    let gradient = isDark ? fallbackDark : fallbackLight;
    if (themeGradients[colorTheme]) {
        gradient = isDark ? themeGradients[colorTheme].dark : themeGradients[colorTheme].light;
    }

    loadingScreen.style.background = gradient;
}

    let tipIndex = 0;
    function rotateTip() {
        const tips = document.querySelectorAll('.loading-tip');
        if (!tips.length) return;
        tips[tipIndex % tips.length].classList.remove('active');
        tipIndex = (tipIndex + 1) % tips.length;
        tips[tipIndex].classList.add('active');
    }

    window.loadingProgress = function(pct, status) {
        const bar    = document.getElementById('loadingBar');
        const stat   = document.getElementById('loadingStatus');
        if (bar)  bar.style.width  = pct + '%';
        if (stat) stat.textContent = status;
    };

    window.hideLoadingScreen = function() {
        const screen = document.getElementById('loadingScreen');
        if (!screen) return;
        screen.classList.add('fade-out');
        setTimeout(() => {
            screen.style.display = 'none';
            // Update theme-color to match actual app theme now that loading is done
            const meta = document.getElementById('themeColorMeta');
            if (meta) {
                const isDark = document.body.classList.contains('dark-mode');
                meta.content = isDark ? '#1f2937' : '#ffffff';
            }
        }, 550);
    };

    document.addEventListener('DOMContentLoaded', () => {
        applyThemeToLoadingScreen();
        const tipInterval = setInterval(rotateTip, 1800);
        let i = 0;
        function runStep() {
            if (i >= steps.length) {
                clearInterval(tipInterval);
                setTimeout(window.hideLoadingScreen, 300);
                return;
            }
            loadingProgress(steps[i].pct, steps[i].status);
            i++;
            setTimeout(runStep, i === steps.length ? 400 : 600);
        }
        setTimeout(runStep, 300);
    });
})();

// ============================================
// PWA INSTALL MODAL
// ============================================
(function setupPWAModal() {
    let deferredPrompt = null;

    function isIOS() {
        return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    }
    function isInStandaloneMode() {
        return window.matchMedia('(display-mode: standalone)').matches
            || window.navigator.standalone === true;
    }
    function shouldShow() {
        if (isInStandaloneMode()) return false;
        if (localStorage.getItem('pwaNeverShow') === 'true') return false;
        const remind = localStorage.getItem('pwaRemindAfter');
        if (remind && Date.now() < parseInt(remind)) return false;
        return true;
    }
    function showModal() {
        if (!shouldShow()) return;
        const modal = document.getElementById('pwaModal');
        if (!modal) return;
        const androidNative = document.getElementById('pwaAndroidNative');
        const iosGuide      = document.getElementById('pwaIOSGuide');
        const genericGuide  = document.getElementById('pwaGenericGuide');
        if (deferredPrompt) {
            androidNative.style.display = 'block';
            iosGuide.style.display = 'none';
            genericGuide.style.display = 'none';
        } else if (isIOS()) {
            androidNative.style.display = 'none';
            iosGuide.style.display = 'block';
            genericGuide.style.display = 'none';
        } else {
            androidNative.style.display = 'none';
            iosGuide.style.display = 'none';
            genericGuide.style.display = 'block';
        }
        modal.style.display = 'flex';
    }
    function hideModal() {
        const modal = document.getElementById('pwaModal');
        if (modal) modal.style.display = 'none';
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        AppState.pwaInstallPrompt = e;
    });

    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => { if (shouldShow()) showModal(); }, 3500);

        const installBtn = document.getElementById('pwaInstallBtn');
        if (installBtn) installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            deferredPrompt = null;
            hideModal();
            if (outcome === 'accepted') localStorage.setItem('pwaNeverShow', 'true');
        });

        const laterBtn = document.getElementById('pwaLaterBtn');
        if (laterBtn) laterBtn.addEventListener('click', () => {
            hideModal();
            localStorage.setItem('pwaRemindAfter', Date.now() + 172800000);
        });

        const neverBtn = document.getElementById('pwaNeverBtn');
        if (neverBtn) neverBtn.addEventListener('click', () => {
            hideModal();
            localStorage.setItem('pwaNeverShow', 'true');
        });

        const closeBtn = document.getElementById('pwaModalClose');
        if (closeBtn) closeBtn.addEventListener('click', hideModal);

        const overlay = document.getElementById('pwaModalOverlay');
        if (overlay) overlay.addEventListener('click', hideModal);
    });

    window.addEventListener('appinstalled', () => {
        hideModal();
        localStorage.setItem('pwaNeverShow', 'true');
    });
})();

// ============================================
// BIDIRECTIONAL TEXT SUPPORT
// ============================================
const TextDirection = {
    wrapLatin: function(text) {
        if (!text) return '';
        const hasLatin = /[A-Za-z0-9]/.test(text);
        if (hasLatin) return `\u202B${text}\u202C`;
        return text;
    },
    wrapPersian: function(text) {
        if (!text) return '';
        const hasRTL = /[\u0600-\u06FF]/.test(text);
        if (hasRTL) return `\u202B${text}\u202C`;
        return text;
    },
    fixMixedText: function(text) {
        if (!text) return '';
        const segments = this.splitByLanguage(text);
        return segments.map(segment => {
            if (segment.isLatin) return this.wrapLatin(segment.text);
            return segment.text;
        }).join('');
    },
    splitByLanguage: function(text) {
        const segments = [];
        let currentSegment = '';
        let currentIsLatin = null;
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const isLatin = /[A-Za-z0-9.,\/;:!?@#$%^&*()_+\-=\[\]{}'"\\|<>]/.test(char);
            if (currentIsLatin !== isLatin && currentSegment !== '') {
                segments.push({ text: currentSegment, isLatin: currentIsLatin });
                currentSegment = '';
            }
            currentSegment += char;
            currentIsLatin = isLatin;
        }
        if (currentSegment !== '') segments.push({ text: currentSegment, isLatin: currentIsLatin });
        return segments;
    },
    formatDrugInfo: function(persian, latin) {
        if (!latin) return persian;
        if (!persian) return this.wrapLatin(latin);
        return `${persian}\u200F \u200E${this.wrapLatin(latin)}\u200F`;
    },
    createBilingualLabel: function(persianLabel, latinValue) {
        return `${persianLabel}:\u200F \u200E${this.wrapLatin(latinValue)}`;
    },
    applyBidiFixes: function() {
        document.querySelectorAll('.text-mixed, .text-latin, .drug-name-english').forEach(el => {
            el.style.unicodeBidi = 'isolate';
            el.style.direction = 'ltr';
        });
        document.querySelectorAll('.persian-text, .drug-name-compact, .selected-drug-name-compact').forEach(el => {
            el.style.unicodeBidi = 'isolate';
            el.style.direction = 'rtl';
        });
        document.querySelectorAll('input[type="number"], input[type="text"]').forEach(input => {
            input.style.unicodeBidi = 'plaintext';
        });
    }
};

// ============================================
// PERSIAN NUMBER SUPPORT
// ============================================
const PersianNumbers = {
    persianToLatin: {
        '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9',
        '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
        '٫':'.','٬':',','،':',','−':'-','–':'-','—':'-'
    },
    latinToPersian: {
        '0':'۰','1':'۱','2':'۲','3':'۳','4':'۴','5':'۵','6':'۶','7':'۷','8':'۸','9':'۹',
        '.':'٫',',':'٬'
    },
    toLatin: function(text) {
        if (!text) return '';
        return text.toString().split('').map(char => this.persianToLatin[char] || char).join('');
    },
    toPersian: function(text) {
        if (!text) return '';
        return text.toString().split('').map(char => this.latinToPersian[char] || char).join('');
    },
    parseNumber: function(text) {
        if (!text || text.toString().trim() === '') return NaN;
        let s = this.toLatin(text.toString()).trim();
        s = s.replace(/\s+/g, '');
        if (s.includes('.')) {
            s = s.replace(/,/g, '');
        } else if (s.includes(',')) {
            const thousandsPattern = /^-?\d{1,3}(,\d{3})+$/;
            if (thousandsPattern.test(s)) {
                s = s.replace(/,/g, '');
            } else {
                s = s.replace(',', '.');
                s = s.replace(/,/g, '');
            }
        }
        return parseFloat(s);
    },
    formatNumber: function(number, decimals = 2) {
        if (!Number.isFinite(number)) return '0';
        const d = parseInt(decimals, 10);
        const usedDecimals = Number.isFinite(d) ? d : 2;
        return number.toFixed(usedDecimals);
    },
    formatMixedText: function(text) {
        if (!text) return '';
        let formatted = this.toLatin(text.toString());
        formatted = TextDirection.fixMixedText(formatted);
        formatted = formatted.replace(/([A-Za-z][A-Za-z0-9\s.,\/;:!?@#$%^&*()_+\-=\[\]{}'"\\|<>]+)/g,
            match => `\u202B${match}\u202C`);
        return formatted;
    },
    parseMixed: function(text) {
        if (!text) return 0;
        let latinText = this.toLatin(text.toString());
        latinText = latinText.replace(/[^\d.\-]/g, '');
        return parseFloat(latinText) || 0;
    },
    bilingual: function(persian, latin, showBoth = true) {
        if (!showBoth || !latin) return persian;
        return `${persian}\u200F \u200E(${latin})\u200F`;
    }
};

// ============================================
// SIMPLE INPUT HANDLING
// ============================================
function renderDrugIcon(iconStr, extraStyle) {
    if (!iconStr) return '<i class="fas fa-pills"></i>';
    return `<i class="${iconStr}"${extraStyle ? ' style="' + extraStyle + '"' : ''}></i>`;
}

function setupSimpleInputHandling() {
    document.querySelectorAll('input[type="text"], input[type="number"], input[type="tel"], textarea').forEach(input => {
        input.style.textAlign = 'center';
    });
    const style = document.createElement('style');
    style.textContent = `::placeholder { text-align: center !important; } input::placeholder { text-align: center !important; }`;
    document.head.appendChild(style);

    document.querySelectorAll('input[type="number"], input[type="text"].numeric-input').forEach(input => {
        input.addEventListener('focus', function() { this.select(); });
        input.addEventListener('click', function() { this.select(); });
    });

    const calculatorInputs = [
        DOM.doctorOrder, DOM.patientWeight, DOM.customVolume,
        document.getElementById('customAmountInput'),
        document.getElementById('manualDrugAmount'),
        document.getElementById('manualDesiredDose'),
        document.getElementById('manualPatientWeight'),
        document.getElementById('manualCustomVolume'),
    ].filter(Boolean);
    calculatorInputs.forEach(input => {
        if (!input) return;
        input.addEventListener('focus', function() { this.select(); });
        input.addEventListener('click', function() { this.select(); });
        input.addEventListener('input', function() {
            const before = this.value || '';
            const normalized = PersianNumbers.toLatin(before);
            if (normalized !== before) {
                const start = this.selectionStart;
                const end = this.selectionEnd;
                this.value = normalized;
                if (start != null && end != null) this.setSelectionRange(start, end);
            }
            const numValue = PersianNumbers.parseNumber(this.value);
            if (!isNaN(numValue)) this.dataset.numericValue = numValue;
            clearResults();
        });
        input.addEventListener('blur', function() {
            if (this.value && this.value.trim() !== '') {
                try {
                    const numValue = PersianNumbers.parseNumber(this.value);
                    if (!isNaN(numValue)) {
                        this.dataset.numericValue = numValue;
                        const decimalsAttr = this.getAttribute('data-decimals');
                        const decimals = decimalsAttr == null ? 2 : parseInt(decimalsAttr, 10);
                        const latinValue = PersianNumbers.formatNumber(numValue, Number.isFinite(decimals) ? decimals : 2);
                        if (this.value !== latinValue) this.value = latinValue;
                    }
                } catch (e) { /* keep original */ }
            }
        });
    });
}

// ============================================
// MOBILE NUMERIC KEYBOARD
// ============================================
function setupMobileNumericKeyboard() {
    document.querySelectorAll('input').forEach(input => {
        const type = input.type;
        const name = input.name || input.id || '';
        const isNumericField = type === 'number' || name.includes('dose') || name.includes('weight') ||
            name.includes('volume') || name.includes('count') || name.includes('value') ||
            name.includes('amount') || input.classList.contains('numeric-input') ||
            input.getAttribute('data-numeric') === 'true';

        if (isNumericField) {
            if (input.getAttribute('step') === '1' || name.includes('count') || name.includes('age') || name.includes('ampoule')) {
                input.setAttribute('inputmode', 'numeric');
                input.setAttribute('pattern', '[0-9]*');
            } else {
                input.setAttribute('inputmode', 'decimal');
                input.setAttribute('pattern', '[0-9]*[.,]?[0-9]*');
            }
            input.classList.add('numeric-keyboard');
            input.style.textAlign = 'center';
            input.addEventListener('input', function() {
                const before = this.value || '';
                const normalized = PersianNumbers.toLatin(before);
                if (normalized !== before) {
                    const start = this.selectionStart;
                    const end = this.selectionEnd;
                    this.value = normalized;
                    if (start != null && end != null) this.setSelectionRange(start, end);
                }
                const numValue = PersianNumbers.parseNumber(this.value);
                if (!isNaN(numValue)) this.dataset.numericValue = numValue;
            });
        }
    });
}

// ============================================
// HAPTIC FEEDBACK
// ============================================
function haptic(ms) {
    if (!AppState.settings.hapticFeedback) return;
    try { if (navigator.vibrate) navigator.vibrate(ms || 30); } catch(e) {}
}

// ============================================
// DOM ELEMENTS
// ============================================
const DOM = {
    themeToggle: document.getElementById('themeToggle'),
    historyBtn: document.getElementById('historyBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    drugGrid: document.getElementById('drugGrid'),
    drugSearch: document.getElementById('drugSearch'),
    selectedDrugIcon: document.getElementById('selectedDrugIcon'),
    selectedDrugName: document.getElementById('selectedDrugName'),
    selectedDrugDesc: document.getElementById('selectedDrugDesc'),
    methodBtns: document.querySelectorAll('.method-btn-compact'),
    volumeOptions: document.getElementById('volumeOptions'),
    customVolume: document.getElementById('customVolume'),
    customVolumeContainer: document.getElementById('customVolumeContainer'),
    ampouleCount: document.getElementById('ampouleCount'),
    ampouleCounterRow: document.getElementById('ampouleCounterRow'),
    customAmountToggle: document.getElementById('customAmountToggle'),
    customAmountToggleRow: document.getElementById('customAmountToggleRow'),
    customAmountIosToggle: document.getElementById('customAmountIosToggle'),
    customAmountToggleClickRow: document.getElementById('customAmountToggleClickRow'),
    customAmountToggleLabel: document.getElementById('customAmountToggleLabel'),
    customAmountInputRow: document.getElementById('customAmountInputRow'),
    customAmountInput: document.getElementById('customAmountInput'),
    customAmountUnit: document.getElementById('customAmountUnit'),
    customAmountPresets: document.getElementById('customAmountPresets'),
    decreaseAmpoule: document.getElementById('decreaseAmpoule'),
    increaseAmpoule: document.getElementById('increaseAmpoule'),
    ampouleInfo: document.getElementById('ampouleInfo'),
    doctorOrder: document.getElementById('doctorOrder'),
    weightContainer: document.getElementById('weightContainer'),
    weightCheckbox: document.getElementById('weightCheckbox'),
    patientWeight: document.getElementById('patientWeight'),
    weightIosToggle: document.getElementById('weightIosToggle'),
    weightInputRow: document.getElementById('weightInputRow'),
    calculateBtn: document.getElementById('calculateBtn'),
    calculateBtnWrap: document.getElementById('calculateBtnWrap'),
    resultsSection: document.getElementById('resultsSection'),
    totalDrugAmount: document.getElementById('totalDrugAmount'),
    totalDrugUnit: document.getElementById('totalDrugUnit'),
    concentrationResult: document.getElementById('concentrationResult'),
    concentrationUnit: document.getElementById('concentrationUnit'),
    pumpRateResult: document.getElementById('pumpRateResult'),
    pumpRateUnit: document.getElementById('pumpRateUnit'),
    durationResult: document.getElementById('durationResult'),
    durationUnit: document.getElementById('durationUnit'),
    guideSection: document.getElementById('guideSection'),
    stepByStepGuide: document.getElementById('stepByStepGuide'),
    warningsSection: document.getElementById('warningsSection'),
    warningsList: document.getElementById('warningsList'),
    compatibilitySection: document.getElementById('compatibilitySection'),
    compatibleDrugsList: document.getElementById('compatibleDrugsList'),
    incompatibleDrugsList: document.getElementById('incompatibleDrugsList'),
    settingsModal: document.getElementById('settingsModal'),
    historyModal: document.getElementById('historyModal'),
    closeSettings: document.getElementById('closeSettings'),
    closeHistory: document.getElementById('closeHistory'),
    largeFontToggle: document.getElementById('largeFontToggle'),
    doseAlertToggle: document.getElementById('doseAlertToggle'),
    compatAlertToggle: document.getElementById('compatAlertToggle'),
    saveHistoryToggle: document.getElementById('saveHistoryToggle'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    exportDataBtn: document.getElementById('exportDataBtn'),
    checkUpdateBtn: document.getElementById('checkUpdateBtn'),
    drugCount: document.getElementById('drugCount'),
    lastUpdate: document.getElementById('lastUpdate'),
    historyList: document.getElementById('historyList'),
    tabItems: document.querySelectorAll('.tab-item'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    librarySearch: document.getElementById('librarySearch'),
    openManualBtn: document.getElementById('openManual'),
    manualSection: document.getElementById('manualSection'),
    calculatorControls: document.getElementById('calculatorControls'),
    hapticToggle: document.getElementById('hapticToggle'),
    reverseCalcBtn: document.querySelector('.reverse-toggle-row'),
    reverseIosToggle: document.getElementById('reverseIosToggle'),
    reverseTooltip: document.getElementById('reverseTooltip'),
    doseRangeIndicator: document.getElementById('doseRangeIndicator'),
    doseRangeDot: document.getElementById('doseRangeDot'),
    doseRangeText: document.getElementById('doseRangeText'),
    dripRateRow: document.getElementById('dripRateRow'),
    dripRateResult: document.getElementById('dripRateResult'),
    dripRateLabel: document.getElementById('dripRateLabel'),
    themeModeSelect: null // removed from UI - theme-mode-btns handles this
};

// ============================================
// MOBILE LAYOUT
// ============================================
function setupMobileLayout() {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        fixTabVisibility();
        positionManualButtonInDrugGrid();
        fixDrugSidebar();
        ensureContentVisibility();
        if (DOM.calculatorControls) DOM.calculatorControls.style.display = 'grid';
        if (DOM.openManualBtn) DOM.openManualBtn.style.display = 'none';
        removeFloatingBars();
        setupMobileSearch();
        setupTouchFeedback();
        fixMethodButtonTextColor();
        TextDirection.applyBidiFixes();
        setupMobileNumericKeyboard();
        if (DOM.calculateBtnWrap) {
            DOM.calculateBtnWrap.style.position = 'sticky';
            DOM.calculateBtnWrap.style.bottom = '0';
            DOM.calculateBtnWrap.style.marginTop = 'auto';
        }
    } else {
        resetDesktopLayout();
    }
}

function clearMobileLayoutIssues() {}

function fixTabVisibility() {
    document.querySelectorAll('.tab-pane').forEach(pane => {
        if (!pane.classList.contains('active')) {
            pane.style.display = 'none';
        }
    });
    const activePane = document.querySelector('.tab-pane.active');
    if (activePane) activePane.style.display = 'block';
}

function fixDrugSidebar() {
    const drugSidebar = document.querySelector('.drug-sidebar');
    if (drugSidebar) drugSidebar.removeAttribute('style');
    const drugQuickSelect = document.querySelector('.drug-quick-select');
    if (drugQuickSelect) drugQuickSelect.removeAttribute('style');
    const drugScroll = document.querySelector('.drug-scroll-container');
    if (drugScroll) drugScroll.removeAttribute('style');
}

function removeFloatingBars() {
    const elementsToHide = [
        '.quick-actions-enhanced', '.quick-actions', '.action-btn-enhanced', '.action-btn',
        '.floating-bar', '.bottom-action-bar', '.overlay-bar', '#floatingBar', '#bottomBar'
    ];
    elementsToHide.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.opacity = '0';
            el.style.position = 'absolute';
            el.style.zIndex = '-100';
        });
    });
}

function ensureContentVisibility() {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.removeAttribute('style');
    const calculatorTab = document.getElementById('calculatorTab');
    if (calculatorTab) calculatorTab.removeAttribute('style');
    const calculatorLayout = document.querySelector('.calculator-layout');
    if (calculatorLayout) calculatorLayout.removeAttribute('style');
    const calculatorMain = document.querySelector('.calculator-main');
    if (calculatorMain) {
        calculatorMain.style.overflowY = 'auto';
        calculatorMain.style.webkitOverflowScrolling = 'touch';
    }
}

function fixVolumeButtonColors() {
    document.querySelectorAll('.volume-preset-btn.active').forEach(btn => {
        btn.style.setProperty('color', 'white', 'important');
        btn.querySelectorAll('.number, .unit-text, .custom-text, span').forEach(el => {
            el.style.setProperty('color', 'white', 'important');
        });
    });
    document.querySelectorAll('.volume-preset-btn:not(.active)').forEach(btn => {
        btn.style.removeProperty('color');
        btn.querySelectorAll('.number, .unit-text, .custom-text, span').forEach(el => {
            el.style.removeProperty('color');
        });
    });
}

function fixMethodButtonTextColor() {
    document.querySelectorAll('.method-btn-compact').forEach(button => {
        if (button.classList.contains('active')) {
            button.style.color = 'white';
            const icon = button.querySelector('i');
            const text = button.querySelector('span');
            if (icon) icon.style.color = 'white';
            if (text) text.style.color = 'white';
        } else {
            button.style.removeProperty('color');
            const icon = button.querySelector('i');
            const text = button.querySelector('span');
            if (icon) icon.style.removeProperty('color');
            if (text) text.style.removeProperty('color');
        }
    });
    fixVolumeButtonColors();
}

function positionManualButtonInDrugGrid() {
    const drugGrid = DOM.drugGrid;
    if (!drugGrid) return;
    const existingBtn = document.getElementById('openManualMobile');
    if (existingBtn) existingBtn.remove();
    const mobileManualBtn = document.createElement('div');
    mobileManualBtn.id = 'openManualMobile';
    mobileManualBtn.className = 'drug-item-compact';
    mobileManualBtn.innerHTML = `
        <div class="drug-icon-small" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
            <i class="fas fa-edit" style="color: white;"></i>
        </div>
        <div class="drug-name-compact" style="font-size: 10px; font-weight: 700;">محاسبه دستی</div>
    `;
    drugGrid.appendChild(mobileManualBtn);
    mobileManualBtn.addEventListener('click', openManualCalculation);
    mobileManualBtn.addEventListener('touchstart', function() { this.style.transform = 'scale(0.95)'; }, { passive: true });
    mobileManualBtn.addEventListener('touchend', function() { this.style.transform = ''; }, { passive: true });
}

function setupMobileSearch() {
    const mobileSearchToggle = document.getElementById('mobileSearchToggle');
    const drugSearchContainer = document.querySelector('.drug-search-container');
    if (mobileSearchToggle && drugSearchContainer) {
        mobileSearchToggle.addEventListener('click', () => {
            drugSearchContainer.style.display = drugSearchContainer.style.display === 'none' ? 'block' : 'none';
        });
    }
}

function setupTouchFeedback() {
    document.querySelectorAll('button, .drug-item-compact, .tab-item').forEach(element => {
        element.addEventListener('touchstart', function() {
            this.style.transform = 'scale(0.97)';
            this.style.transition = 'transform 0.1s ease';
        }, { passive: true });
        element.addEventListener('touchend', function() {
            this.style.transform = '';
        }, { passive: true });
    });
}

function resetDesktopLayout() {
    const mobileBtn = document.getElementById('openManualMobile');
    if (mobileBtn) mobileBtn.remove();
    if (DOM.openManualBtn) DOM.openManualBtn.style.display = 'flex';
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    loadDrugGrid();
    selectDrug('heparin');
    loadDrugLibrary();
    initVoiceTab();
});

function initializeApp() {
    function setVH() {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }
    setVH();
    window.addEventListener('resize', setVH);
    if (window.loadingProgress) loadingProgress(20, 'در حال بارگذاری پایگاه داده دارویی...');
    loadSettings();
    loadTheme();
    updateStats();
    updateVolumeOptions();
    setupMobileLayout();
    initSwipe();
    setupMobileOptimizations();
    setupSimpleInputHandling();
    TextDirection.applyBidiFixes();
    setupMobileNumericKeyboard();
    initializeConverters();
    initializeTools();

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => setupMobileLayout(), 150);
    });

    if (DOM.drugCount) DOM.drugCount.textContent = Object.keys(drugDatabase).length;
    if (DOM.lastUpdate) {
        const now = new Date();
        const persianDate = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
        if (DOM.lastUpdate) DOM.lastUpdate.textContent = PersianNumbers.toLatin(persianDate);
    }
    setupManualCalculation();
    setupOnboarding();
    setupOfflineIndicator();
    setupTabBarMeasurement();
    setupGCS();
    setupBurns();
    setupRASS();
    setupBraden();
    setupMorse();
    setupOxygenCalculator();
    setupYSiteChecker();
    setupVentilatorCalc();
    // VBG mode toggle
    document.querySelectorAll('#vbgModeBtns .method-btn-compact').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('#vbgModeBtns .method-btn-compact').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const isABG = this.dataset.mode === 'abg';
            const chk = document.getElementById('vbgModeABG');
            if (chk) chk.checked = isABG;
            const note = document.getElementById('vbgModeNote');
            if (note) note.innerHTML = isABG
                ? '<i class="fas fa-info-circle"></i> حالت ABG: مقادیر شریانی مستقیم تفسیر می‌شوند.'
                : '<i class="fas fa-info-circle"></i> حالت VBG: pH وریدی معمولاً ۰.۰۳–۰.۰۵ کمتر از شریانی است. pCO₂ وریدی ۶–۸ mmHg بالاتر است.';
        });
    });
    setupThemePicker();
    setupUpdateDetection();
    setupThemeModeListener();
    setupUserName();
    setTimeout(showGreetingBanner, 3200);
    setupHelpPopovers();
}

function setupMobileOptimizations() {
    if (window.innerWidth <= 768) {
        document.addEventListener('touchstart', function(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
                document.body.style.zoom = '100%';
            }
        }, { passive: true });
        const drugScroll = document.querySelector('.drug-scroll-container');
        if (drugScroll) {
            drugScroll.addEventListener('touchmove', function(e) { e.stopPropagation(); }, { passive: true });
        }
    }
}

// ============================================
// SETTINGS
// ============================================
function loadSettings() {
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        AppState.settings = Object.assign({}, AppState.settings, parsed);
    }
    if (DOM.darkModeToggle) DOM.darkModeToggle.checked = AppState.settings.darkMode;
    if (DOM.largeFontToggle) DOM.largeFontToggle.checked = AppState.settings.largeFont;
    if (DOM.doseAlertToggle) DOM.doseAlertToggle.checked = AppState.settings.doseAlerts;
    if (DOM.compatAlertToggle) DOM.compatAlertToggle.checked = AppState.settings.compatAlerts;
    if (DOM.saveHistoryToggle) DOM.saveHistoryToggle.checked = AppState.settings.saveHistory;
    if (DOM.hapticToggle) DOM.hapticToggle.checked = AppState.settings.hapticFeedback !== false;
    if (DOM.themeModeSelect) DOM.themeModeSelect.value = AppState.settings.themeMode || 'light';
    applySettings();
    syncThemeModeButtons();
}

function saveSettings() {
    localStorage.setItem('appSettings', JSON.stringify(AppState.settings));
}

function applySettings() {
    if (AppState.settings.darkMode) {
        document.body.classList.add('dark-mode');
        AppState.theme = 'dark';
        if (DOM.darkModeToggle) DOM.darkModeToggle.checked = true;
        if (DOM.themeToggle) {
            const icon = DOM.themeToggle.querySelector('i');
            if (icon) icon.className = 'fas fa-sun';
        }
    } else {
        document.body.classList.remove('dark-mode');
        AppState.theme = 'light';
        if (DOM.darkModeToggle) DOM.darkModeToggle.checked = false;
        if (DOM.themeToggle) {
            const icon = DOM.themeToggle.querySelector('i');
            if (icon) icon.className = 'fas fa-moon';
        }
    }
    if (AppState.settings.largeFont) document.body.classList.add('large-font');
    else document.body.classList.remove('large-font');
    const savedColor = AppState.settings.colorTheme || 'default';
    applyTheme(savedColor);
    fixVolumeButtonColors();
}

// ============================================
// DRUG MANAGEMENT
// ============================================
function loadDrugGrid() {
    const container = DOM.drugGrid;
    if (!container) return;
    container.innerHTML = '';
    Object.entries(drugDatabase).forEach(([id, drug]) => {
        const card = document.createElement('div');
        card.className = 'drug-item-compact';
        card.dataset.drugId = id;
        card.innerHTML = `
            <div class="drug-icon-small">${renderDrugIcon(drug.icon)}</div>
            <div class="drug-name-compact">${drug.persianName}</div>
            <div class="drug-name-english">${drug.englishName}</div>
        `;
        card.addEventListener('click', () => selectDrug(id));
        container.appendChild(card);
    });
    setupMobileLayout();
}

function selectDrug(drugId) {
    if (!drugDatabase[drugId]) return;
    const drug = drugDatabase[drugId];
    AppState.selectedDrug = drugId;
    AppState.ampouleCount = drug.defaultAmpoules;
    AppState.currentAmpouleIndex = 0;

    // Close manual calculator if open
    const manualSection = document.getElementById('manualSection');
    const calculatorControls = document.getElementById('calculatorControls');
    if (manualSection && manualSection.style.display !== 'none') {
        manualSection.style.display = 'none';
        if (calculatorControls) calculatorControls.style.display = 'grid';
        if (DOM.calculateBtnWrap) DOM.calculateBtnWrap.style.display = 'block';
        const selectedDrugHeader = document.querySelector('.selected-drug-compact');
        if (selectedDrugHeader) selectedDrugHeader.style.display = 'flex';
        const drugSidebar = document.querySelector('.drug-sidebar');
        if (drugSidebar && window.innerWidth < 768) drugSidebar.removeAttribute('style');
    }

    if (DOM.selectedDrugName) DOM.selectedDrugName.textContent = drug.persianName;
    if (DOM.selectedDrugDesc) DOM.selectedDrugDesc.innerHTML = `
        <span class="persian-inline">${drug.persianName}</span>
        <span> - </span>
        <span class="latin-inline">${drug.englishName}</span>
        <span> (</span><span class="latin-inline">${drug.category}</span><span>)</span>
    `;
    if (DOM.selectedDrugIcon) DOM.selectedDrugIcon.innerHTML = renderDrugIcon(drug.icon, 'font-size:1.5rem;');
    if (DOM.selectedDrugIcon) DOM.selectedDrugIcon.style.background = `linear-gradient(135deg, ${drug.color}, ${drug.color}99)`;

    updateAmpouleTypeSelector(drug);
    updateAmpouleInfo();
    updateVolumeOptions();
    setupCustomAmountUI(drug);

    if (DOM.weightContainer && DOM.weightCheckbox && DOM.patientWeight) {
        if (drug.weightBased && drug.weightBased.active) {
            DOM.weightContainer.style.display = 'block';
            if (DOM.weightIosToggle) DOM.weightIosToggle.classList.remove('on');
            if (DOM.weightInputRow) DOM.weightInputRow.style.display = 'none';
            const defaultUseWeight = drug.weightBased.defaultUseWeight !== undefined ? drug.weightBased.defaultUseWeight : false;
            AppState.useWeight = defaultUseWeight;
            DOM.weightCheckbox.checked = defaultUseWeight;
            DOM.patientWeight.disabled = !defaultUseWeight;
            DOM.patientWeight.value = drug.weightBased.defaultWeight || '70';
            DOM.patientWeight.setAttribute('inputmode', 'decimal');
            DOM.patientWeight.style.textAlign = 'center';
            updateWeightBasedUnit(drug);
        } else {
            DOM.weightContainer.style.display = 'none';
            AppState.useWeight = false;
            DOM.weightCheckbox.checked = false;
            DOM.patientWeight.disabled = true;
            DOM.patientWeight.value = '';
            const unitElement = document.getElementById('orderUnit');
            if (unitElement) unitElement.textContent = drug.standardUnit;
        }
    }

    if (DOM.doctorOrder) {
        DOM.doctorOrder.setAttribute('inputmode', 'decimal');
        DOM.doctorOrder.style.textAlign = 'center';
        DOM.doctorOrder.value = '';
    }

    document.querySelectorAll('.drug-item-compact').forEach(card => card.classList.remove('selected'));
    const selectedCard = document.querySelector(`.drug-item-compact[data-drug-id="${drugId}"]`);
    if (selectedCard) selectedCard.classList.add('selected');

    clearResults();
    if (DOM.customVolumeContainer) {
        DOM.customVolumeContainer.style.display = 'none';
        DOM.customVolume.value = '';
    }
    AppState.customVolume = false;
}

function updateAmpouleTypeSelector(drug) {
    const container = document.getElementById('ampouleTypeButtons');
    if (!container) return;
    container.innerHTML = '';
    if (drug.ampouleOptions.length <= 1) {
        container.style.display = 'none';
        AppState.currentAmpouleIndex = 0;
        updateAmpouleInfo();
        return;
    }
    container.style.display = 'flex';
    drug.ampouleOptions.forEach((ampoule, index) => {
        const button = document.createElement('button');
        button.className = 'ampoule-type-btn';
        button.textContent = ampoule.label;
        button.dataset.index = index;
        if (index === AppState.currentAmpouleIndex) button.classList.add('active');
        button.addEventListener('click', () => {
            container.querySelectorAll('.ampoule-type-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            AppState.currentAmpouleIndex = index;
            updateAmpouleInfo();
            clearResults();
        });
        container.appendChild(button);
    });
}

function updateAmpouleInfo() {
    const drug = drugDatabase[AppState.selectedDrug];
    const ampoule = drug.ampouleOptions[AppState.currentAmpouleIndex];
    if (DOM.ampouleCount) DOM.ampouleCount.textContent = AppState.ampouleCount;
    if (DOM.ampouleInfo) {
        const labelParts = ampoule.label.split(' in ');
        if (labelParts.length === 2) {
            DOM.ampouleInfo.innerHTML = `<span>هر آمپول: </span><span class="latin-inline">${labelParts[0]}</span><span> در </span><span class="latin-inline">${labelParts[1]}</span>`;
        } else {
            DOM.ampouleInfo.innerHTML = `<span>هر آمپول: </span><span class="latin-inline">${ampoule.label}</span>`;
        }
    }
}

function setupCustomAmountUI(drug) {
    const isInsulin = drug.id === 'insulin';
    const ampoule = drug.ampouleOptions[AppState.currentAmpouleIndex] || drug.ampouleOptions[0];
    const unit = ampoule.unit;

    AppState.useCustomDrugAmount = isInsulin;
    AppState.customDrugAmount = null;

    if (DOM.customAmountUnit) DOM.customAmountUnit.textContent = unit;
    if (DOM.customAmountInput) {
        DOM.customAmountInput.value = '';
        DOM.customAmountInput.placeholder = isInsulin ? 'واحد اضافه‌شده...' : `مقدار به ${unit}...`;
    }

    // Build preset chips
    if (DOM.customAmountPresets) {
        DOM.customAmountPresets.innerHTML = '';
        const presets = getAmountPresets(drug, unit);
        presets.forEach(val => {
            const chip = document.createElement('button');
            chip.className = 'amount-preset-chip';
            chip.textContent = val + ' ' + unit;
            chip.addEventListener('click', () => {
                if (DOM.customAmountInput) {
                    DOM.customAmountInput.value = val;
                    DOM.customAmountInput.dataset.numericValue = val;
                }
                DOM.customAmountPresets.querySelectorAll('.amount-preset-chip')
                    .forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                clearResults();
            });
            DOM.customAmountPresets.appendChild(chip);
        });
        DOM.customAmountPresets.style.display = presets.length ? 'flex' : 'none';
    }

    function setCustomOn(on) {
        AppState.useCustomDrugAmount = on;
        AppState.customDrugAmount = null;
        if (DOM.customAmountToggle) DOM.customAmountToggle.checked = on;
        if (DOM.customAmountIosToggle) DOM.customAmountIosToggle.classList.toggle('on', on);
        if (DOM.customAmountInputRow) DOM.customAmountInputRow.style.display = on ? 'block' : 'none';
        if (!isInsulin) {
            if (DOM.ampouleCounterRow) DOM.ampouleCounterRow.classList.toggle('ampoule-greyed', on);
            if (DOM.ampouleInfo) DOM.ampouleInfo.classList.toggle('ampoule-greyed', on);
        }
        if (!on && DOM.customAmountInput) DOM.customAmountInput.value = '';
        if (!on && DOM.customAmountPresets) {
            DOM.customAmountPresets.querySelectorAll('.amount-preset-chip')
                .forEach(c => c.classList.remove('active'));
        }
        clearResults();
    }

    if (isInsulin) {
        // Insulin: hide toggle row, always show input row independently
        if (DOM.customAmountToggleRow) DOM.customAmountToggleRow.style.display = 'none';
        if (DOM.ampouleCounterRow) DOM.ampouleCounterRow.style.display = 'none';
        if (DOM.ampouleInfo) DOM.ampouleInfo.style.display = 'none';
        if (DOM.customAmountInputRow) DOM.customAmountInputRow.style.display = 'block';
    } else {
        if (DOM.customAmountToggleRow) DOM.customAmountToggleRow.style.display = 'block';
        if (DOM.customAmountToggleLabel) DOM.customAmountToggleLabel.textContent = 'مقدار دلخواه دارو';
        if (DOM.ampouleCounterRow) { DOM.ampouleCounterRow.style.display = 'block'; DOM.ampouleCounterRow.classList.remove('ampoule-greyed'); }
        if (DOM.ampouleInfo) { DOM.ampouleInfo.style.display = ''; DOM.ampouleInfo.classList.remove('ampoule-greyed'); }
        if (DOM.customAmountInputRow) DOM.customAmountInputRow.style.display = 'none';

        // Wire iOS toggle row — full row tap
        const clickRow = DOM.customAmountToggleClickRow;
        if (clickRow) {
            const newRow = clickRow.cloneNode(true);
            clickRow.parentNode.replaceChild(newRow, clickRow);
            DOM.customAmountToggleClickRow = newRow;
            DOM.customAmountIosToggle = newRow.querySelector('.ios-toggle');
            DOM.customAmountToggle = newRow.querySelector('input[type=checkbox]');
            newRow.addEventListener('click', (e) => {
                if (e.target.closest('.help-icon')) return;
                haptic(25);
                setCustomOn(!AppState.useCustomDrugAmount);
            });
        }
        setCustomOn(false);
    }
}


function getAmountPresets(drug, unit) {
    const perDrug = {
        heparin:       [10000, 25000],
        lasix:         [50, 100],
        insulin:       [20, 25, 50, 100],
        fentanyl:      [500, 1000],
        pantoprazole:  [80],
        tng:           [5, 10, 20],
        norepinephrine:[4, 5, 10],
        midazolam:     [10, 20, 25, 50],
        octreotide:    [250, 500],
        labetalol:     [50, 100, 200],
        dopamine:      [200, 400],
        amiodarone:    [150, 300],
    };
    return perDrug[drug.id] || [];
}


function getEffectiveTotalDrug() {
    // Returns the total drug amount to use in calculation
    if (AppState.useCustomDrugAmount) {
        const raw = DOM.customAmountInput ? PersianNumbers.parseNumber(DOM.customAmountInput.value) : NaN;
        if (!isNaN(raw) && raw > 0) return raw;
        return null; // signal: invalid
    }
    const drug = drugDatabase[AppState.selectedDrug];
    const ampoule = drug.ampouleOptions[AppState.currentAmpouleIndex];
    return AppState.ampouleCount * ampoule.strength;
}

function updateVolumeOptions() {
    const drug = drugDatabase[AppState.selectedDrug];
    const method = AppState.infusionMethod;
    const volumes = drug.defaultSolutionVolumes[method];
    const defaultVol = drug.defaultVolume[method];
    if (!DOM.volumeOptions) return;
    DOM.volumeOptions.innerHTML = '';
    volumes.forEach(volume => {
        const btn = document.createElement('button');
        btn.className = 'volume-preset-btn';
        btn.innerHTML = `<span class="number">${volume}</span><span class="unit-text">cc</span>`;
        btn.dataset.volume = volume;
        if (volume === defaultVol) {
            btn.classList.add('active');
            AppState.solutionVolume = volume;
        }
        btn.addEventListener('click', () => {
            document.querySelectorAll('.volume-preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            AppState.solutionVolume = volume;
            if (DOM.customVolumeContainer) { DOM.customVolumeContainer.style.display = 'none'; DOM.customVolume.value = ''; }
            AppState.customVolume = false;
            clearResults();
            fixVolumeButtonColors();
        });
        DOM.volumeOptions.appendChild(btn);
    });
    const customBtn = document.createElement('button');
    customBtn.className = 'volume-preset-btn';
    customBtn.innerHTML = '<span class="custom-text">سایر</span>';
    customBtn.addEventListener('click', () => {
        if (DOM.customVolumeContainer) {
            DOM.customVolumeContainer.style.display = 'flex';
            DOM.customVolume.focus();
            AppState.customVolume = true;
            document.querySelectorAll('.volume-preset-btn').forEach(b => b.classList.remove('active'));
            clearResults();
            fixVolumeButtonColors();
        }
    });
    DOM.volumeOptions.appendChild(customBtn);
    fixVolumeButtonColors();
}

// ============================================
// CALCULATION
// ============================================
function calculateInfusion() {
    const drug = drugDatabase[AppState.selectedDrug];
    const ampoule = drug.ampouleOptions[AppState.currentAmpouleIndex];

    let doseValue;
    if (DOM.doctorOrder.value && DOM.doctorOrder.value.trim() !== '') {
        doseValue = DOM.doctorOrder.dataset.numericValue
            ? parseFloat(DOM.doctorOrder.dataset.numericValue)
            : PersianNumbers.parseNumber(DOM.doctorOrder.value);
    }

    if (!doseValue || isNaN(doseValue) || doseValue <= 0) {
        showToast('خطا', 'لطفاً مقدار دوز درخواستی را وارد کنید', 'error');
        DOM.doctorOrder.focus();
        DOM.doctorOrder.style.borderColor = 'var(--danger)';
        return;
    }
    DOM.doctorOrder.style.borderColor = '';
    updateDoseRangeIndicator();

    let desiredDosePerHour;

    // Parse units to drive all conversion logic
    const stdUnit = drug.standardUnit || '';
    const ampouleInMg = (drug.ampouleOptions[0]?.unit || '') === 'mg';
    let doseAlreadyNormalized = false;

    if (drug.weightBased && drug.weightBased.active && AppState.useWeight) {
        let weightValue;
        if (DOM.patientWeight.value && DOM.patientWeight.value.trim() !== '') {
            weightValue = DOM.patientWeight.dataset.numericValue
                ? parseFloat(DOM.patientWeight.dataset.numericValue)
                : PersianNumbers.parseNumber(DOM.patientWeight.value);
        }
        if (!weightValue || isNaN(weightValue) || weightValue <= 0) {
            showToast('خطا', 'لطفاً وزن بیمار را وارد کنید', 'error');
            DOM.patientWeight.focus();
            DOM.patientWeight.style.borderColor = 'var(--danger)';
            return;
        }
        DOM.patientWeight.style.borderColor = '';
        AppState.patientWeight = weightValue;

        // Use weightBased.unit for the weight branch — it reflects what the user actually enters
        const wbUnit = drug.weightBased.unit || stdUnit;
        const wbPerMin = wbUnit.includes('/min');
        const wbInMcg  = wbUnit.startsWith('mcg');

        // Convert dose (wbUnit) → drug storage unit per hour
        let dosePerHour = doseValue * weightValue * (wbPerMin ? 60 : 1);
        // If wb dose is in mcg but ampoule is in mg → convert to mg/h now;
        // flag so concentration step doesn't double-convert
        if (wbInMcg && ampouleInMg) {
            dosePerHour /= 1000;
            doseAlreadyNormalized = true;
        }
        desiredDosePerHour = dosePerHour;

    } else {
        AppState.patientWeight = null;
        const isPerMin = stdUnit.includes('/min');
        // Non-weight: mg/min or mcg/min → ×60; mg/h or units/h → ×1
        desiredDosePerHour = doseValue * (isPerMin ? 60 : 1);
    }

    // doseInMcg used for concentration unit conversion below
    const doseInMcg = stdUnit.startsWith('mcg');

    if (AppState.customVolume) {
        let customVol;
        if (DOM.customVolume.value && DOM.customVolume.value.trim() !== '') {
            customVol = DOM.customVolume.dataset.numericValue
                ? parseFloat(DOM.customVolume.dataset.numericValue)
                : PersianNumbers.parseNumber(DOM.customVolume.value);
        }
        if (!customVol || isNaN(customVol) || customVol <= 0) {
            showToast('خطا', 'حجم محلول وارد شده معتبر نیست', 'error');
            DOM.customVolume.focus();
            return;
        }
        AppState.solutionVolume = customVol;
    }

    AppState.desiredDose = doseValue;

    // Custom drug amount takes priority over ampoule count × strength
    const totalDrug = getEffectiveTotalDrug();
    if (totalDrug === null) {
        showToast('خطا', `لطفاً مقدار دارو را وارد کنید`, 'error');
        if (DOM.customAmountInput) DOM.customAmountInput.focus();
        return;
    }

    const concentration = totalDrug / AppState.solutionVolume;

    let totalDrugForCalculation = totalDrug;
    let concentrationForCalculation = concentration;
    let desiredDoseForCalculation = desiredDosePerHour;

    // If dose unit is mcg but ampoule/drug is stored in mg → convert drug to mcg for concentration
    // Skip if weight branch already normalized dose to mg (prevents double-conversion)
    if (doseInMcg && ampouleInMg && !doseAlreadyNormalized) {
        totalDrugForCalculation = totalDrug * 1000;
        concentrationForCalculation = totalDrugForCalculation / AppState.solutionVolume;
    }

    const pumpRate = desiredDoseForCalculation / concentrationForCalculation;
    const duration = AppState.solutionVolume / pumpRate;

    displayResults(totalDrug, concentration, pumpRate, duration, ampoule.unit);
    displayDripRate(pumpRate, AppState.solutionVolume);
    generateStepByStepGuide(drug, totalDrug, concentration, pumpRate, doseValue);
    displayWarnings(drug);
    displayCompatibility(drug);

    if (AppState.settings.saveHistory) saveCalculation(totalDrug, concentration, pumpRate, duration);
    updateCalculationStats();
    showToast('موفق', 'محاسبه با موفقیت انجام شد', 'success');
}

function displayResults(totalDrug, concentration, pumpRate, duration, unit) {
    const drug = drugDatabase[AppState.selectedDrug];
    DOM.totalDrugAmount.textContent = PersianNumbers.formatNumber(totalDrug, 0);
    DOM.totalDrugUnit.innerHTML = `<span class="latin-inline">${unit}</span>`;

    let concentrationDisplay, concentrationUnitDisplay;
    const _doseInMcg = (drug.standardUnit || '').startsWith('mcg');
    const _ampouleInMg = (drug.ampouleOptions[0]?.unit || '') === 'mg';
    if (_doseInMcg && _ampouleInMg) {
        concentrationDisplay = PersianNumbers.formatNumber(concentration * 1000, 2);
        concentrationUnitDisplay = 'mcg/cc';
    } else {
        concentrationDisplay = PersianNumbers.formatNumber(concentration, 2);
        concentrationUnitDisplay = `${unit}/cc`;
    }
    DOM.concentrationResult.textContent = concentrationDisplay;
    DOM.concentrationUnit.innerHTML = `<span class="latin-inline">${concentrationUnitDisplay}</span>`;
    DOM.pumpRateResult.textContent = PersianNumbers.formatNumber(pumpRate, 2);
    DOM.pumpRateUnit.innerHTML = `<span class="latin-inline">cc/hour</span>`;
    DOM.durationResult.textContent = PersianNumbers.formatNumber(duration, 1);
    DOM.durationUnit.innerHTML = `<span class="persian-inline">ساعت</span>`;

    if (DOM.resultsSection) {
        DOM.resultsSection.classList.add('show');
        DOM.resultsSection.style.display = 'block';
        setTimeout(() => DOM.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    }
}

function clearResults() {
    if (DOM.resultsSection) { DOM.resultsSection.classList.remove('show'); DOM.resultsSection.style.display = 'none'; }
    if (DOM.guideSection) DOM.guideSection.style.display = 'none';
    if (DOM.warningsSection) DOM.warningsSection.style.display = 'none';
    if (DOM.compatibilitySection) DOM.compatibilitySection.style.display = 'none';
    if (DOM.dripRateRow) DOM.dripRateRow.style.display = 'none';
    const pumpRateCard = document.getElementById('pumpRateResult')?.closest('.result-item-enhanced');
    if (pumpRateCard) {
        pumpRateCard.classList.remove('highlight');
        const labelEl = pumpRateCard.querySelector('.result-label-enhanced');
        const valueEl = pumpRateCard.querySelector('.result-value-enhanced');
        const unitEl = pumpRateCard.querySelector('.result-unit-enhanced');
        if (labelEl) labelEl.textContent = 'سرعت پمپ';
        if (valueEl) { valueEl.textContent = '0'; valueEl.style.color = ''; }
        if (unitEl) unitEl.innerHTML = '';
    }
    const origHighlight = document.querySelector('.result-item-enhanced:nth-child(3)');
    if (origHighlight && !origHighlight.classList.contains('highlight')) origHighlight.classList.add('highlight');
}

function generateStepByStepGuide(drug, totalDrug, concentration, pumpRate, desiredDose) {
    if (!DOM.guideSection || !DOM.stepByStepGuide) return;
    DOM.stepByStepGuide.innerHTML = '';
    const { factor: dripFactor, label: dripLabel } = getDripFactor(AppState.solutionVolume);
    const dropsPerMin = (pumpRate * dripFactor) / 60;
    const setType = AppState.solutionVolume <= 100 ? 'سرنگ پمپ / میکروست' : 'ست وریدی ماکروست';
    const drugPrep = AppState.useCustomDrugAmount
        ? `اضافه کردن ${PersianNumbers.formatNumber(totalDrug, 0)} ${drug.ampouleOptions[0].unit} از ${drug.persianName} به محلول`
        : `آماده کردن ${AppState.ampouleCount} آمپول ${drug.persianName}`;
    const steps = [
        `۱. ${drugPrep}`,
        `۲. کشیدن ${AppState.solutionVolume} cc محلول ${drug.solutionType[0]} به سرنگ/کیسه`,
        `۳. اضافه کردن ${PersianNumbers.formatNumber(totalDrug, 0)} ${drug.ampouleOptions[0].unit} از دارو به محلول`,
        `۴. مخلوط کردن کامل محلول`,
        `۵. نصب بر روی پمپ ${AppState.infusionMethod === 'syringe' ? 'سرنگ' : 'انفوزیون'} با ${setType}`,
        `۶. تنظیم سرعت پمپ روی ${PersianNumbers.formatNumber(pumpRate, 2)} cc/hour`,
        `۷. در صورت تزریق گراویتی: ${PersianNumbers.formatNumber(dropsPerMin, 1)} قطره/دقیقه (${dripLabel})`,
        `۸. شروع تزریق با دوز ${PersianNumbers.formatNumber(desiredDose, 2)} ${drug.standardUnit}`
    ];
    steps.forEach(step => {
        const stepDiv = document.createElement('div');
        stepDiv.className = 'guide-step';
        stepDiv.innerHTML = `<div class="step-content">${step}</div>`;
        DOM.stepByStepGuide.appendChild(stepDiv);
    });
    DOM.guideSection.style.display = 'block';
}

function displayWarnings(drug) {
    if (!DOM.warningsSection || !DOM.warningsList) return;
    const cautions = drug?.cautions;
    if (!cautions || !Array.isArray(cautions) || cautions.length === 0) {
        DOM.warningsSection.style.display = 'none';
        return;
    }
    DOM.warningsList.innerHTML = '';
    cautions.forEach(caution => {
        const warningDiv = document.createElement('div');
        warningDiv.className = 'warning-item';
        warningDiv.innerHTML = `<i class="fas fa-exclamation-circle warning-icon"></i><span class="warning-text">${caution}</span>`;
        DOM.warningsList.appendChild(warningDiv);
    });
    DOM.warningsSection.style.display = 'block';
}

function displayCompatibility(drug) {
    if (!DOM.compatibilitySection || !DOM.compatibleDrugsList || !DOM.incompatibleDrugsList) return;
    DOM.compatibleDrugsList.innerHTML = '';
    DOM.incompatibleDrugsList.innerHTML = '';
    if (drug.ySiteCompatibilities) {
        drug.ySiteCompatibilities.compatible.forEach(drugName => {
            const item = document.createElement('div');
            item.textContent = drugName;
            item.className = 'persian-text';
            DOM.compatibleDrugsList.appendChild(item);
        });
        drug.ySiteCompatibilities.incompatible.forEach(drugName => {
            const item = document.createElement('div');
            item.textContent = drugName;
            item.className = 'persian-text';
            DOM.incompatibleDrugsList.appendChild(item);
        });
    }
    DOM.compatibilitySection.style.display = 'block';
}

function updateWeightBasedUnit(drug) {
    const unitElement = document.getElementById('orderUnit');
    if (!unitElement || !drug.weightBased) return;
    unitElement.textContent = AppState.useWeight ? drug.weightBased.unit : (drug.weightBased.nonWeightUnit || drug.standardUnit);
    clearResults();
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
    function animateBtn(btn) {
        if (!btn) return;
        btn.classList.add('btn-press');
        btn.classList.add('btn-spin');
        setTimeout(() => btn.classList.remove('btn-press'), 150);
        setTimeout(() => btn.classList.remove('btn-spin'), 500);
    }

    ['themeToggle', 'historyBtn', 'settingsBtn'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('touchstart', () => animateBtn(btn), { passive: true });
        btn.addEventListener('mousedown', () => animateBtn(btn));
    });

    if (DOM.themeToggle) DOM.themeToggle.addEventListener('click', () => { haptic(25); toggleTheme(); });
    if (DOM.historyBtn) DOM.historyBtn.addEventListener('click', () => {
        loadHistory();
        if (DOM.historyModal) { DOM.historyModal.classList.add('active'); document.body.classList.add('no-scroll'); }
    });
    if (DOM.settingsBtn) DOM.settingsBtn.addEventListener('click', () => {
        if (DOM.settingsModal) { DOM.settingsModal.classList.add('active'); document.body.classList.add('no-scroll'); }
    });
    if (DOM.tabItems) DOM.tabItems.forEach(btn => btn.addEventListener('click', function() { switchTab(this.dataset.tab); }));
    if (DOM.methodBtns) DOM.methodBtns.forEach(btn => btn.addEventListener('click', function() {
        DOM.methodBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        AppState.infusionMethod = this.dataset.method;
        fixMethodButtonTextColor();
        updateVolumeOptions();
        clearResults();
    }));
    if (DOM.decreaseAmpoule) DOM.decreaseAmpoule.addEventListener('click', () => {
        if (AppState.ampouleCount > 1) { AppState.ampouleCount--; updateAmpouleInfo(); clearResults(); }
    });
    if (DOM.increaseAmpoule) DOM.increaseAmpoule.addEventListener('click', () => {
        const drug = drugDatabase[AppState.selectedDrug];
        const maxAmpoules = Math.floor(1000 / drug.ampouleOptions[0].strength) || 20;
        if (AppState.ampouleCount < maxAmpoules) { AppState.ampouleCount++; updateAmpouleInfo(); clearResults(); }
    });
    
    // Weight toggle row click handling (whole row)
    const weightToggleRow = document.getElementById('weightToggleRow');
    if (weightToggleRow) {
        weightToggleRow.addEventListener('click', (e) => {
            if (e.target.closest('.help-icon')) return; // let help popover handle it
            // Prevent toggling twice if the click came from the toggle itself
            if (e.target.closest('.ios-toggle')) return;
            haptic(25);
            AppState.useWeight = !AppState.useWeight;
            if (DOM.weightCheckbox) DOM.weightCheckbox.checked = AppState.useWeight;
            if (DOM.weightIosToggle) DOM.weightIosToggle.classList.toggle('on', AppState.useWeight);
            if (DOM.weightInputRow) {
                DOM.weightInputRow.style.display = AppState.useWeight ? 'flex' : 'none';
            }
            if (DOM.patientWeight) {
                DOM.patientWeight.disabled = !AppState.useWeight;
                if (AppState.useWeight) setTimeout(() => DOM.patientWeight.focus(), 150);
            }
            const drug = drugDatabase[AppState.selectedDrug];
            updateWeightBasedUnit(drug);
            clearResults();
        });
    }
    
    // Also keep individual toggle click (to update the row state without double toggling)
    if (DOM.weightIosToggle) {
        DOM.weightIosToggle.addEventListener('click', (e) => {
            e.stopPropagation(); // prevent row handler from firing again
            haptic(25);
            AppState.useWeight = !AppState.useWeight;
            if (DOM.weightCheckbox) DOM.weightCheckbox.checked = AppState.useWeight;
