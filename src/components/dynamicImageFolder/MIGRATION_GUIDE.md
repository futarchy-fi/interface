# Dynamic Share Card Widget Migration Guide

This folder contains a standalone widget for generating and downloading dynamic share cards for markets, powered by Supabase and html2canvas.

## 📦 Contents

- `DynamicShareCard.jsx`: Main container component handling state, data fetching, and export logic.
- `ShareProposalsCard.jsx`: Visual functional component for rendering the card content.
- `MIGRATION_GUIDE.md`: This file.

## 🚀 Quick Start

1.  **Copy this folder** (`dynamicImageFolder`) to your project's component directory (e.g., `src/components/dynamicImageFolder`).
2.  **Install dependencies**:
    ```bash
    npm install html2canvas
    ```
    *(Note: Ensure you have `react` and `react-dom` installed)*

## 🛠 Configuration

### 1. Environment Variables
The widget fetches data directly from Supabase. Ensure your project has the following environment variables set (or compatible replacements):

```env
NEXT_PUBLIC_SUPABASE_URL=https://nvhqdqtlsdboctqjcelq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Tailwind CSS Configuration
This widget uses specific custom colors and fonts defined in `tailwind.config.js`. You must add these to your configuration to ensure the styles render correctly.

**Fonts:**
- `font-oxanium`: Requires the Oxanium font to be loaded in your project.

**Colors to Add:**
Add the following `colors` to your `tailwind.config.js` theme extension:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        futarchyViolet7: "#B27CFA",
        futarchyViolet9: "#AB6BFF",
        futarchyViolet10: "#7E38CA", // Approximate
        futarchyTeal7: "#00A89D",
        futarchyTeal9: "#007C6B",
        futarchyTeal10: "#004D40", // Approximate
        futarchyGold7: "#F5C400",
        futarchyGold9: "#C48F00",
        futarchyGold10: "#8F5C00", // Approximate
        futarchyBlue7: "#8EC8F6",
        futarchyBlue9: "#0090FF",
        futarchyBlue10: "#0D74CE", // Approximate
        futarchyCrimson9: "#E93D82",
        futarchyCrimson10: "#CB1D63", // Approximate
        futarchyDarkGray2: "#191919",
        futarchyDarkGray3: "#222222",
        futarchyGray11: "#636363",
      },
      fontFamily: {
        oxanium: ["var(--font-oxanium)", "system-ui", "sans-serif"],
      }
    }
  }
}
```

## 💻 Usage

Import and use the component in your page or layout:

```jsx
import useState from 'react';
import DynamicShareCard from './dynamicImageFolder/DynamicShareCard';

const MyPage = () => {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsShareModalOpen(true)}>
        Open Share Card
      </button>

      <DynamicShareCard
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />
    </>
  );
};
```

## 🤖 AI Implementation Prompt

If you are using an AI assistant to help migrate this widget, you can use the following prompt:

> "I need to integrate a Dynamic Share Card widget into my React application. I have a folder `dynamicImageFolder` containing `DynamicShareCard.jsx` and `ShareProposalsCard.jsx`.
>
> 1. Please help me install `html2canvas`.
> 2. Configure my `tailwind.config.js` with the necessary `futarchy*` colors and `oxanium` font family found in the MIGRATION_GUIDE.md.
> 3. Verify that my environment variables for Supabase (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are set up correctly for fetching company and market data.
> 4. Help me import and render `<DynamicShareCard />` in my main page component, connected to a button state."
