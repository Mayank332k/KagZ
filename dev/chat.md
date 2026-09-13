# UI Design System & Reverse-Engineering Blueprint (Pure Chat Experience)

This document contains a **100% complete**, exhaustive design specification extracted directly from the provided React/JSX, CSS, and Theme configuration of the chat interface. It has been stripped of auxiliary features (like voice mode, hints, and session controls) to focus entirely on the **pure chat experience**. 

Every single HEX, RGB, and RGBA value found in the source code has been documented below without exception.

---

## 1. Complete Color Matrix (Every RGB/RGBA/HEX Value)

The application uses an extensive set of CSS tokens for seamless Light/Dark mode toggling, combined with specific hardcoded RGB/RGBA values for blurs, overlays, and shadows.

### A. Core Base & Surface Colors
| Element | Dark Mode | Light Mode |
| :--- | :--- | :--- |
| **`--bg-base`** (Global Background) | `#000000` | `#FFFFFF` (Overridden in CSS to `rgb(252, 252, 252)`) |
| **`--bg-surface`** (Elevated Elements) | `#111111` | `#F8F9FA` |
| **`--bg-hover`** (Hover States) | `rgb(32, 32, 32)` | `#F1F3F5` |
| **`--border`** (Standard Lines) | `rgba(255, 255, 255, 0.1)` | `rgba(0, 0, 0, 0.08)` |
| **`--chat-pill`** (Pills & Code Blocks) | `rgb(32, 32, 32)` | `#F1F3F5` |
| **`--chat-pill-hover`** | `rgb(42, 42, 42)` | `#E9ECEF` |

### B. Text & Typography Colors
| Element | Dark Mode | Light Mode |
| :--- | :--- | :--- |
| **`--text-primary`** | `#F5F5F5` | `#1A1A1A` |
| **`--text-secondary`** | `#C7C7C7` | `#495057` |
| **`--text-muted`** | `#858585` | `#868E96` |
| **`--accent`** (Bold Text, Links) | `#FFFFFF` (Falls back to `#a855f7`) | `#000000` (Falls back to `#a855f7`) |
| **`--accent-hover`** | `#E7E7E7` | `#212529` |
| **`--accent-warm`** | `#D1D5DB` | `#4B5563` |

### C. System Colors (Status & Alerts)
| Element | Universal | Dark Mode Specific | Light Mode Specific |
| :--- | :--- | :--- | :--- |
| **`--info`** (Links/Highlights) | `#60A5FA` | - | - |
| **`--error` / `--danger`** | `#EF4444` | - | - |
| **`--bg-error`** | - | `rgba(239, 68, 68, 0.14)` | `rgba(239, 68, 68, 0.08)` |
| **`--border-error`** | - | `rgba(239, 68, 68, 0.28)` | `rgba(239, 68, 68, 0.2)` |
| **Error Chat Bubble Text** | `#dc2626` | - | - |
| **Focus-Visible Outline** | `#8b5cf6` | - | - |

### D. Glassmorphism, Blurs, & Shadows
| Element | Dark Mode | Light Mode |
| :--- | :--- | :--- |
| **`--glass-bg`** | `rgba(32, 32, 32, 0.82)` | `rgba(255, 255, 255, 0.88)` |
| **`--glass-bg-solid`** | `rgba(32, 32, 32, 0.96)` | `rgba(255, 255, 255, 0.96)` |
| **`--glass-bg-hover`** | `rgba(42, 42, 42, 0.92)` | `rgba(240, 240, 240, 0.92)` |
| **`--glass-highlight`** | `rgba(255, 255, 255, 0.08)` | `rgba(0, 0, 0, 0.05)` |
| **`--glass-highlight-hover`** | `rgba(255, 255, 255, 0.14)` | `rgba(0, 0, 0, 0.1)` |
| **`--shimmer-from`** | `rgba(255, 255, 255, 0.05)` | `rgba(0, 0, 0, 0.06)` |
| **`--shimmer-mid`** | `rgba(255, 255, 255, 0.12)` | `rgba(0, 0, 0, 0.12)` |
| **`--shadow-card`** | `0 18px 48px rgba(0, 0, 0, 0.32)` | `0 12px 32px rgba(0, 0, 0, 0.05)` |
| **`--shadow-card-hover`**| `0 24px 58px rgba(0, 0, 0, 0.42)` | `0 18px 42px rgba(0, 0, 0, 0.08)` |

### E. Code Syntax Highlighting (Prism Variables)

| Token Type | Dark Mode (`One Dark` inspired) | Light Mode (`Premium Developer`) |
| :--- | :--- | :--- |
| **Base Text** | `#d6deeb` | `#24292e` (Charcoal black) |
| **Comment/Doctype**| `#7f848e` | `#a0a6b2` (Delicate minimal gray) |
| **Punctuation** | `#abb2bf` | `#383a42` (Premium dark slate) |
| **Keyword/Atrule** | `#c678dd` | `#a626a4` (Royal amethyst violet) |
| **String/Regex** | `#98c379` | `#50a14f` (Classy organic olive green) |
| **Number/Boolean** | `#d19a66` | `#986801` (Terracotta deep amber) |
| **Function/Class** | `#61afef` | `#4078f2` (Professional sapphire blue) |
| **Property/Tag** | `#e06c75` | `#e06c75` (Premium soft coral red) |
| **Operator/URL** | `#56b6c2` | `#0184bc` (Deep slate teal) |

### F. Exact Hardcoded Element Colors (No Tokens)
| Element | Dark Mode | Light Mode |
| :--- | :--- | :--- |
| **User Message Bubble BG** | `rgb(50, 50, 50)` | `rgb(240, 240, 240)` |
| **User Message Bubble Text** | `#fff` | `#1a1a1a` |
| **Composer Input Wrapper BG** | `rgb(25, 25, 25)` | `rgb(25, 25, 25)` *(Inherited/Same)* |
| **Inline Code Background** | `rgb(50, 50, 50)` | `rgb(240, 240, 240)` |
| **Blockquote Left Indicator** | `#383838` | `#d1d5db` |
| **Insight Card Accent Bar** | `#404040` | `#9ca3af` |
| **Insight Card Text** | `#f5f5f5` | `#111827` |
| **Code Block Copy Hover** | `rgba(255, 255, 255, 0.08)` | `rgba(255, 255, 255, 0.08)` |
| **Table Fallback Surface**| `rgba(255, 255, 255, 0.02)` | `rgba(255, 255, 255, 0.02)` |
| **Table Header Fallback** | `rgba(255, 255, 255, 0.08)` | `rgba(255, 255, 255, 0.08)` |
| **Table Row Hover** | `rgba(255, 255, 255, 0.03)` | `rgba(255, 255, 255, 0.03)` |

### G. Layered Blur Gradients (Top Header & Bottom Footer)
To prevent text from clipping harshly against the top and bottom of the screen, 3 layers of progressive blur are applied using `-webkit-mask-image`. 

**Top Header Masks (Linear-Gradient 'To Bottom')**
* **Dark Mode**
  * **Layer 1 (blur 4px):** `rgba(0, 0, 0, 0.4)` to `rgba(0, 0, 0, 0.15)` to `transparent`
  * **Layer 2 (blur 12px):** `rgba(0, 0, 0, 0.7)` to `rgba(0, 0, 0, 0.3)` to `transparent`
  * **Layer 3 (blur 32px):** `#000000` to `rgba(0, 0, 0, 0.8)` to `transparent`
* **Light Mode**
  * **Layer 1 (blur 4px):** `rgba(255, 255, 255, 0.4)` to `rgba(255, 255, 255, 0.15)` to `transparent`
  * **Layer 2 (blur 12px):** `rgba(255, 255, 255, 0.7)` to `rgba(255, 255, 255, 0.3)` to `transparent`
  * **Layer 3 (blur 32px):** `#ffffff` to `rgba(255, 255, 255, 0.8)` to `transparent`

**Bottom Footer Masks (Linear-Gradient 'To Top')**
* **Dark Mode**
  * **Layer 1 (blur 4px):** `rgba(0, 0, 0, 0.4)` to `rgba(0, 0, 0, 0.15)` to `transparent`
  * **Layer 2 (blur 12px):** `rgba(0, 0, 0, 0.7)` to `rgba(0, 0, 0, 0.3)` to `transparent`
  * **Layer 3 (blur 32px):** `#000000` to `rgba(0, 0, 0, 0.8)` to `transparent`
* **Light Mode**
  * **Layer 1 (blur 4px):** `rgba(252, 252, 252, 0.4)` to `rgba(252, 252, 252, 0.15)` to `transparent`
  * **Layer 2 (blur 12px):** `rgba(252, 252, 252, 0.7)` to `rgba(252, 252, 252, 0.3)` to `transparent`
  * **Layer 3 (blur 32px):** `rgb(252, 252, 252)` to `rgba(252, 252, 252, 0.8)` to `transparent`

**Footer Base Background (Desktop Only)**
* **Dark Mode:** `rgba(0, 0, 0, 0.85)` (12px fade)
* **Light Mode:** `rgba(255, 255, 255, 0.85)` (12px fade)

### H. Avatar Glow / Drop Shadows
When the AI is generating text, its avatar applies a pulsing `drop-shadow`.
* **Dark Mode:** `rgba(100, 150, 255, 0.5)` (Base `0 0 10px`), pulses to `rgba(100, 150, 255, 0.9)` (Max `0 0 16px`), drops to `rgba(100, 150, 255, 0.3)` (Min `0 0 4px`).
* **Light Mode:** `rgba(0, 0, 0, 0.2)` (Base `0 0 8px`), pulses to `rgba(0, 0, 0, 0.3)` (Max `0 0 12px`), drops to `rgba(0, 0, 0, 0.1)` (Min `0 0 4px`).

---

## 2. Typography & Spacing System

**Font Families:**
* Main: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
* Code: `"Fira Code", "SFMono-Regular", Consolas, Menlo, monospace` *(Important: Forced to `font-weight: 300` for a sleek developer look)*

**Base Font Settings:**
* Global Body Size: `16px`
* Global Line Height: `1.7`
* Global Letter Spacing: `0.02em`

### Spacing Scale
* `--space-micro`: 4px
* `--space-tight`: 8px
* `--space-internal`: 12px
* `--space-default`: 16px
* `--space-section`: 24px
* `--space-large`: 32px
* `--space-xlarge`: 48px

### Border Radius Scale
* **Tags/Inline Code**: 6px
* **Small UI/Copy Buttons**: 8px
* **Focus Outlines**: 10px
* **AI Chat Bubble / Tables**: 12px
* **Code Blocks**: 25px
* **User Chat Bubble / Composer Wrapper**: 32px
* **Send Button**: 50% (Perfect circle)

---

## 3. Layout Blueprint

```text
App Shell (100vh, 100vw, flex, overflow: hidden)
└── Main Canvas (Flex: 1, position: relative, bg: var(--bg-base))
    │
    ├── Header (Absolute, H: 72px, Z: 30)
    │   └── Blur Layers (3 stacked gradient masks for seamless fade)
    │
    ├── Chat Scroll Area (Overflow-y: auto, Flex: 1, padding: 120px 0 176px)
    │   └── Message List (Max-width: 800px, padding: 0 20px, flex column, gap 16px)
    │       ├── AI Message (Max-width 100%, flex start)
    │       └── User Message (Max-width 60%, flex end)
    │
    └── Footer (Absolute Bottom, padding 12px 20px, Z: 40)
        ├── Blur Layers (3 stacked gradient masks for seamless fade)
        └── Form (Flex column, centered, Max-width: 770px)
            └── Composer Pill (Input Wrapper)
```

---

## 4. Message Composer (Textarea) Specification

**Wrapper (`.inputWrapper`)**
* **Border**: `1px solid var(--border)` (Changes to `--chat-border-strong` on focus-within).
* **Border Radius**: `32px`
* **Padding**: `4px 8px 4px 20px`
* **Effect**: `backdrop-filter: blur(16px) saturate(180%)`
* **Transition**: `all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)`

**Textarea (`.textarea`)**
* **Font**: 17.5px, Weight 500, Line-height 24px.
* **Padding**: `8px 0`
* **Height Control**: Min `40px`, Max `150px`, auto-grows via JS measuring `scrollHeight`.
* **Overflow**: `overflow-y: auto` (Scrollable when max height is reached).
* **Reset**: `outline: none`, `resize: none`, `box-shadow: none`.
* **Placeholder Opacity**: `0.7`

**Send Button (`.sendIcon`)**
* **Size**: 40x40px (Border radius 50%).
* **Hover**: `transform: scale(1.05)`, border color changes to accent.
* **Active**: `transform: scale(0.97)`
* **Disabled**: `opacity: 0.38`.

---

## 5. Chat Message Specifications

### User Message
* **Alignment**: Flex-end (Right)
* **Max Width**: 60% of container.
* **Padding**: `12px 20px`
* **Border Radius**: `32px`
* **Typography**: 18.5px, Line-height 1.4, Weight 500.

### AI Message (Assistant)
* **Alignment**: Flex-start (Left), centered within max-width.
* **Max Width**: 100% of the 800px column.
* **Background**: Transparent.
* **Padding**: `16px 20px` (Inner markdown container removes native padding).
* **Border Radius**: `12px` (Implicit from container).
* **Typography**: 16px, Line-height 1.6, Weight 420.
* **Animation**: `.markdownContent` uses `animation: contentFadeIn 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards`.

---

## 6. Exhaustive Markdown Rendering Details

The AI messages are parsed using `react-markdown` + `remark-gfm` and strictly styled via CSS modules.

### Headings
* **H1**: `32px (1.6rem)`, Weight 800, `border-bottom: 1px solid var(--border)`, padding-bottom `0.35rem`, margin-top `1.5rem`.
* **H2**: `24px (1.35rem)`, Weight 700, margin-top `1.5rem`.
* **H3**: `18px (1.15rem)`, Weight 700, color `var(--accent)`.
* **H4**: `1.02rem`, Weight 700, color `var(--text-secondary)`, `text-transform: uppercase`, `letter-spacing: 0.05em`.

### Lists (`ul`, `ol`, `li`)
* **Padding**: `padding-left: 16px`
* **Margin Bottom**: `1.25rem`
* **List Item (`li`)**: `margin-bottom: 8px`, `line-height: 1.6`.

### Inline Code
* **Padding**: `2px 6px`
* **Border Radius**: `6px`
* **Font Size**: `0.9em`

### Block Code (`pre` / `code`)
* **Container**: `border-radius: 25px`, `margin: 16px 4px`. Width is `calc(100% - 8px)`.
* **Header Bar**: Flexbox, `padding: 12px 20px 4px`, transparent background.
* **Language Label**: `12px`, Weight 600, `text-transform: capitalize`, color `var(--text-muted)`.
* **Copy Button**: `32x32px`, `border-radius: 8px`.
* **Content Scroll Area**: Max height `350px`, `overflow: auto`, hidden scrollbars (`scrollbar-width: none`).

### Tables
* **Wrapper**: `width: 100%`, `overflow-x: auto`, `border-radius: 12px`, `border: 1px solid var(--border)`.
* **TH/TD**: `padding: 12px 16px`, `border-bottom: 1px solid var(--border)`, font-size `0.92rem`.
* **TH**: Weight 700, color `var(--text-primary)`.

### Blockquotes
* **Structure**: `max-width: 55ch`, `padding: 4px 0 4px 20px`, `margin: 1.5rem 0`, `line-height: 1.7`.
* **Quotes**: Uses typographic curly quotes: `quotes: "“" "”" "‘" "’"`.
* **Left Indicator Bar**: Achieved via `::before` pseudo-element. `width: 4px`, `border-radius: 9999px`.
* **Citations (`cite`, `footer`)**: Fade opacity to `0.6`, `margin-top: 0.5rem`, `font-size: 0.9em`.

### Dynamic "Insight/Feedback" Cards
* **Container**: `max-width: 530px`, transparent background, `margin: 1.5rem 0`.
* **Animation**: `animation: questionCardFadeIn 0.4s ease-out`.
* **Accent Bar**: `width: 4px`, `border-radius: 9999px`.
* **Text Formatting**: `font-size: 16px`.

### Links & Horizontal Rules
* **Links (`a`)**: Color `var(--accent)`, `text-decoration: underline`, `text-underline-offset: 4px`, `font-weight: 500`. Hover opacity 0.8.
* **Rules (`hr`)**: `margin: 0.75rem 0`, `border-top: 1px solid var(--border)`.

---

## 7. Responsive Design Specifics

* **Desktop (`min-width: 769px`)**: 
  * Progressive footer/header blurs are fully visible.
  * Content container horizontally centered with `padding: 0 40px`.
* **Mobile (`max-width: 768px`)**:
  * Base padding reduced to `--space-section` (`24px`).
  * `aiAvatar` adjusts margins (top 0, bottom 6px), resizes SVG to exactly `20x20px`.
  * `messageRowInner` switches to `flex-direction: column`. Avatars stack directly above bubbles.
  * Progressive blur layers (`headerBlurContainer`, `footerBlurContainer`) are explicitly set to `display: none` to optimize rendering performance on mobile browsers.
