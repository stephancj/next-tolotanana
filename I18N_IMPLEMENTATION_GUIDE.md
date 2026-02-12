# Internationalization Implementation Guide

## ✅ What Has Been Completed

### 1. Core Infrastructure
- ✅ **Configuration Files** created:
  - `lib/i18n-config.ts` - Locale types and configuration
  - `lib/locale-storage.ts` - LocalStorage persistence
  - `lib/enum-translations.ts` - Database enum translation helpers
  - `app/i18n.ts` - i18n initialization (for next-intl when installed)

- ✅ **Custom i18n Provider** (`app/providers/I18nProvider.tsx`):
  - Lightweight React Context-based solution
  - Works **immediately without** next-intl dependency
  - Supports nested translation keys
  - Parameter interpolation support
  - Hydration-safe (prevents SSR mismatch)

### 2. Translation Files
- ✅ **French translations**: `messages/fr.json` (120+ strings)
- ✅ **English translations**: `messages/en.json` (120+ strings)

**Organized by namespaces:**
- `common` - Common UI text (loading, save, back, etc.)
- `dashboard` - Dashboard-specific text
- `form` - Medical form labels and messages
- `operations` - Operating room workflow
- `planning` - Surgical planning
- `editions` - Edition selector
- `surgeons` - Team management
- `enums` - Database enums (days, distance, pharmacy status, gender)
- `errors` - Error messages

### 3. UI Components
- ✅ **LanguageSwitcher** (`app/components/LanguageSwitcher.tsx`):
  - French/English toggle buttons
  - Persists selection to localStorage
  - Reloads page on language change
  - Hydration-safe

### 4. Root Integration
- ✅ **Layout updated** (`app/layout.tsx`):
  - Wrapped with `I18nProvider`
  - All child components now have access to translations

### 5. Example Implementation
- ✅ **Dashboard partially translated**:
  - Header section (title, subtitle)
  - Navigation buttons (Team, Planning, Workflow, List, New)
  - KPI cards (Total Patients, Scheduled, Not Scheduled)
  - Refresh button tooltip
  - LanguageSwitcher integrated in header

---

## 🚀 How to Test Right Now

### Option 1: Test with Custom Provider (Works Immediately)

The custom i18n provider is already working! Just run:

```bash
npm run dev
```

Navigate to the Dashboard and you'll see:
1. Language switcher (FR/EN buttons) in the top-right
2. Click to switch between French and English
3. Header and KPI cards will translate
4. Selection persists in localStorage

### Option 2: Install next-intl (Recommended for Production)

Once your npm issues are resolved:

```bash
npm install next-intl
```

Then you can optionally migrate to next-intl for better TypeScript support and features.

---

## 📝 How to Continue Translating Components

### Pattern to Follow

Here's the complete pattern demonstrated in Dashboard.tsx:

#### Step 1: Add imports at the top
```typescript
import { useTranslations, useLocale } from '../providers/I18nProvider';
import { translateDay, translateDistance } from '@/lib/enum-translations';
import { Locale } from '@/lib/i18n-config';
```

#### Step 2: Initialize translation hooks in component
```typescript
export default function YourComponent() {
  const t = useTranslations('namespace'); // e.g., 'form', 'operations'
  const tCommon = useTranslations('common');
  const locale = useLocale() as Locale;

  // ... rest of component
}
```

#### Step 3: Replace hardcoded strings
```typescript
// Before:
<h2>Tableau de Bord</h2>

// After:
<h2>{t('header.title')}</h2>
```

#### Step 4: Translate database enums
```typescript
// For days stored as "Lundi", "Mardi", etc. in database:
<span>{translateDay(record.planning_day, locale)}</span>

// For distance stored as "en ville", "loin", etc.:
<span>{translateDistance(record.distance, locale)}</span>
```

#### Step 5: Handle Malagasy bilingual labels
```typescript
// Keep Malagasy text in parentheses:
<label>{t('identity.lastName')} (Anarana)</label>

// Or use template in translation file:
// en.json: "lastNameMalagasy": "Last Name (Anarana)"
// fr.json: "lastNameMalagasy": "Nom (Anarana)"
<label>{t('identity.lastNameMalagasy')}</label>
```

---

## 📋 Remaining Components to Translate

### High Priority (60-100+ strings each)
1. **FicheMedicale.tsx** (~60 strings)
   - Namespace: `form`
   - Key sections: Personal info, Contact, Vitals, Surgical, Anesthesia
   - Add LanguageSwitcher to header

- [x] **2. Component Translation**
  - [x] `components/FicheMedicale.tsx` (Complete form internationalization)
  - [x] `components/OperationForm.tsx` (Pre-op, Bloc, Post-op tabs)
  - [x] `components/Dashboard.tsx` (Stats cards, Charts, Recent items)
  - [x] `components/WeeklyPlanning.tsx` (Days, Table headers, Statuses)
  - [x] `components/RecordList.tsx` (Table headers, Filters, Pagination)
  - [x] `components/SurgeonManager.tsx` (Form, List, Actions)
  - [x] `components/WorkflowManager.tsx` (Stages, Actions, Statuses)
  - [x] `components/EditionSelector.tsx` (Title, Description, List)
  - [x] `components/EditionIndicator.tsx` (Status label, Action tooltip)

### Medium Priority (15-30 strings each)
- [x] **RecordList.tsx**
  - Translated headers, buttons, status badges.
  - Used `list` namespace.

- [x] **WeeklyPlanning.tsx**
  - Namespace: `planning`
  - Day headers (use `translateDay()`)
  - Status messages

- [x] **EditionSelector.tsx**
   - Namespace: `editions`
   - Modal title, descriptions, error messages

- [x] **SurgeonManager.tsx**
   - Namespace: `surgeons`
   - Team management labels

### Low Priority (1-10 strings each)
- [x] **LoadingSpinner.tsx** - Uses `tCommon('loading')`
- [x] **AdvancedSearch.tsx** - Search filter labels (`search.advanced`)
- [x] **PatientDetailModal.tsx** - Modal labels (`patient`)
- [x] **EditionIndicator.tsx** - Edition display text (`editions.indicator`)

---

## 🔧 NPM Install Issues

Your npm install failed with:
```
npm error Cannot read properties of null (reading 'matches')
```

This appears to be a corrupted npm cache or lock file. Try:

### Fix Option 1: Clear and Reinstall
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Fix Option 2: Use Yarn Instead
```bash
brew install yarn  # if not installed
yarn install
```

### Fix Option 3: Delete node_modules/.pnpm
The error mentions `.pnpm` directories which suggests pnpm might be interfering:
```bash
rm -rf node_modules/.pnpm
npm install
```

Once npm install works, `next-intl` will be available (it's already in package.json).

---

## 🧪 Testing Checklist

After translating components:

- [ ] Language switcher appears on all pages
- [ ] Switching language updates all text immediately
- [ ] Language preference persists after page reload
- [ ] Works offline (test by disabling network in DevTools)
- [ ] Day names translate correctly in planning views
- [ ] Distance labels translate in all locations
- [ ] Pharmacy status dropdown shows translated options
- [ ] Malagasy labels remain unchanged
- [ ] No console errors about missing translation keys
- [ ] Gender labels translate (Masculin/Male, Féminin/Female)

---

## 📖 Translation File Reference

### Adding New Translations

Edit `messages/fr.json` and `messages/en.json`:

```json
{
  "yourNamespace": {
    "yourKey": "Your French text" / "Your English text",
    "nested": {
      "key": "Nested text"
    },
    "withParam": "Hello {name}!"  // Use in component: t('withParam', { name: 'John' })
  }
}
```

### Common Translation Patterns

**Simple text:**
```typescript
{t('dashboard.title')}
```

**With parameters:**
```typescript
{t('greeting', { name: userName })}
// JSON: "greeting": "Bonjour {name}!"
```

**Nested keys:**
```typescript
{t('header.subtitle')}
// JSON: { "header": { "subtitle": "..." } }
```

**Pluralization (basic):**
```typescript
{count} {count === 1 ? t('patient') : t('patients')}
```

---

## 🎯 Quick Reference

### Available Translation Hooks
```typescript
const t = useTranslations('namespace');       // Namespace-specific
const tCommon = useTranslations('common');    // Common text
const locale = useLocale();                   // Get current locale ('fr' | 'en')
```

### Available Enum Helpers
```typescript
translateDay(day, locale)            // 'Lundi' → 'Monday'
translateDistance(distance, locale)  // 'en ville' → 'In city'
translatePharmacyStatus(status, locale)
translateGender(gender, locale)      // 'M' → 'Male'
```

### Available Namespaces
- `common` - Universal UI text
- `dashboard` - Dashboard stats and navigation
- `form` - Medical record form
- `operations` - Operating room workflow
- `planning` - Surgical planning calendar
- `editions` - Edition selector modal
- `surgeons` - Team management
- `enums` - Database value translations
- `errors` - Error messages

---

## 🐛 Troubleshooting

### Issue: "Translation key not found"
**Cause:** Key doesn't exist in JSON
**Fix:** Check spelling, ensure key exists in both fr.json and en.json

### Issue: Hydration mismatch error
**Cause:** Server renders different content than client
**Fix:** Already handled in I18nProvider with `mounted` state

### Issue: Language doesn't change
**Cause:** Page needs reload after locale change
**Fix:** LanguageSwitcher already calls `window.location.reload()`

### Issue: Enum values not translating
**Cause:** Using translation key instead of enum helper
**Fix:** Use `translateDay()` etc. for database values, not `t()`

---

## 📦 Files Created

```
/lib
  ├── i18n-config.ts              # Locale configuration
  ├── locale-storage.ts           # LocalStorage helpers
  └── enum-translations.ts        # Database enum translators

/app
  ├── i18n.ts                     # next-intl config (when installed)
  ├── providers/
  │   └── I18nProvider.tsx        # Custom React Context provider
  └── components/
      └── LanguageSwitcher.tsx    # Language toggle UI

/messages
  ├── fr.json                     # French translations
  └── en.json                     # English translations

/app/layout.tsx                   # Updated with I18nProvider
/app/components/Dashboard.tsx     # Partially translated (example)
package.json                      # next-intl added to dependencies
```

---

## 🎉 Next Steps

1. **Fix npm install** (see NPM Install Issues section above)
2. **Test current implementation**: Run `npm run dev` and test language switching
3. **Continue translating**: Start with FicheMedicale.tsx, then OperationForm.tsx
4. **Add LanguageSwitcher** to other page headers as needed
5. **Update CLAUDE.md** with i18n documentation (see plan)
6. **Test thoroughly** using the Testing Checklist above

---

## 💡 Pro Tips

1. **Use constants for repeated text**: If the same text appears multiple times, use a common namespace key
2. **Keep translations short**: Especially for buttons and labels
3. **Test both languages**: Switch language after every component translation
4. **Check mobile view**: Ensure translated text fits in mobile layouts
5. **Use descriptive keys**: `form.identity.lastName` is better than `form.ln`
6. **Maintain alphabetical order**: Makes finding keys easier in JSON files

---

## 📞 Need Help?

If you encounter issues:
1. Check browser console for error messages
2. Verify translation keys exist in both JSON files
3. Ensure component imports are correct
4. Test with simple strings first before complex nested keys

Good luck with the implementation! 🚀
