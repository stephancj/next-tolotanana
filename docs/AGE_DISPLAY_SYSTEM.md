# Système d'Affichage de l'Âge - Documentation

## Vue d'ensemble

Le système d'affichage de l'âge utilise des **badges colorés avec icônes** pour distinguer visuellement les différentes catégories d'âge dans l'application.

## Composant `AgeDisplay`

### Localisation
`app/components/RecordList.tsx` (lignes 13-41)

### Fonctionnalité
Le composant `AgeDisplay` affiche l'âge avec un badge coloré selon l'unité de temps :

```tsx
<AgeDisplay age={record.age} />
```

### Catégories et Styles

| Catégorie | Détection | Couleur Badge | Icône | Exemple |
|-----------|-----------|---------------|-------|---------|
| **Nouveau-né** | Contient "semaine" | Rose (`bg-pink-100`, `text-pink-700`) | 👶 | "3 semaines" |
| **Bébé** | Contient "mois" | Violet (`bg-purple-100`, `text-purple-700`) | 🍼 | "6 mois" |
| **Enfant/Adulte** | Contient "an" | Indigo (`bg-indigo-100`, `text-indigo-700`) | 🎂 | "25 ans" |
| **Non spécifié** | Aucune correspondance | Gris (`bg-gray-100`, `text-gray-700`) | 📅 | "?" |

### Code du Composant

```tsx
const AgeDisplay = ({ age }: { age: string | number }) => {
    const ageStr = String(age || '?');
    
    // Détermination de la couleur selon l'unité
    let bgColor = 'bg-gray-100';
    let textColor = 'text-gray-700';
    let icon = '📅';
    
    if (ageStr.includes('semaine')) {
        bgColor = 'bg-pink-100';
        textColor = 'text-pink-700';
        icon = '👶';
    } else if (ageStr.includes('mois')) {
        bgColor = 'bg-purple-100';
        textColor = 'text-purple-700';
        icon = '🍼';
    } else if (ageStr.includes('an')) {
        bgColor = 'bg-indigo-100';
        textColor = 'text-indigo-700';
        icon = '🎂';
    }
    
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${bgColor} ${textColor}`}>
            <span className="text-sm">{icon}</span>
            {ageStr}
        </span>
    );
};
```

## Utilisation dans l'Application

### 1. Tableau Principal
**Fichier:** `RecordList.tsx` (ligne 329-331)

```tsx
<td className="px-4 py-3 text-center">
    <AgeDisplay age={r.age} />
</td>
```

**Rendu:**
- Affiche un badge coloré dans la colonne "Âge"
- Facilite l'identification rapide des nouveau-nés et bébés
- Tri intelligent via `getAgeValue()` pour ordonner correctement

### 2. Modal de Détails
**Fichier:** `RecordList.tsx` (ligne 451-454)

```tsx
<div className="flex flex-col">
    <span className="text-xs font-semibold text-gray-500 mb-1">Âge</span>
    <AgeDisplay age={selectedRecord.age} />
</div>
```

**Rendu:**
- Badge coloré avec label "Âge" au-dessus
- Cohérence visuelle avec le tableau

## Calcul Automatique de l'Âge

### Fonction `calculateAge`
**Fichier:** `lib/age-utils.ts`

La fonction calcule automatiquement l'âge à partir de la date de naissance :

```typescript
export function calculateAge(dob: string): string {
    if (!dob) return '';
    
    const birthDate = new Date(dob);
    const today = new Date();
    const diffMs = today.getTime() - birthDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    // Moins de 8 semaines → affichage en semaines
    if (diffDays < 56) {
        const weeks = Math.floor(diffDays / 7);
        return weeks === 0 ? '< 1 semaine' : 
               weeks === 1 ? '1 semaine' : 
               `${weeks} semaines`;
    }
    
    // Calcul en mois
    let months = (today.getFullYear() - birthDate.getFullYear()) * 12;
    months += today.getMonth() - birthDate.getMonth();
    if (today.getDate() < birthDate.getDate()) {
        months--;
    }
    
    // Moins de 24 mois → affichage en mois
    if (months < 24) {
        return months === 1 ? '1 mois' : `${months} mois`;
    }
    
    // Calcul en années
    let years = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        years--;
    }
    
    return years === 0 ? '< 1 an' : 
           years === 1 ? '1 an' : 
           `${years} ans`;
}
```

### Logique de Calcul

| Âge Réel | Affichage | Catégorie |
|----------|-----------|-----------|
| 0-7 jours | "< 1 semaine" | Nouveau-né |
| 1-7 semaines | "1-7 semaines" | Nouveau-né |
| 2-23 mois | "2-23 mois" | Bébé |
| 0-11 mois (1ère année) | "< 1 an" | Bébé |
| 1 an | "1 an" | Enfant |
| 2+ ans | "X ans" | Enfant/Adulte |

## Tri des Âges

### Fonction `getAgeValue`
**Fichier:** `lib/age-utils.ts`

Convertit l'âge string en valeur numérique pour le tri :

```typescript
export function getAgeValue(age: string): number {
    if (!age) return 0;
    
    const match = age.match(/(\d+)/);
    if (!match) return 0;
    
    const value = parseInt(match[1], 10);
    
    if (age.includes('semaine')) {
        return value / 52; // Fraction d'année
    } else if (age.includes('mois')) {
        return value / 12; // Fraction d'année
    }
    
    return value; // Déjà en années
}
```

**Exemple de tri:**
1. "3 semaines" → 0.058 ans
2. "6 mois" → 0.5 ans
3. "1 an" → 1 ans
4. "25 ans" → 25 ans

## Avantages du Système

### 1. **Identification Visuelle Rapide**
- Les badges colorés permettent de repérer instantanément les nouveau-nés (rose) et bébés (violet)
- Important pour les priorités médicales

### 2. **Précision pour les Jeunes Patients**
- Affichage en semaines pour les nouveau-nés (< 8 semaines)
- Affichage en mois pour les bébés (< 2 ans)
- Plus pertinent médicalement que l'âge en années

### 3. **Cohérence Visuelle**
- Même style de badge dans le tableau et le modal
- Icônes intuitives (👶 🍼 🎂)

### 4. **Tri Intelligent**
- Conversion automatique pour tri correct
- "3 semaines" < "6 mois" < "1 an" < "25 ans"

## Personnalisation

Pour modifier les couleurs ou icônes, éditer le composant `AgeDisplay` :

```tsx
// Exemple : changer la couleur pour les bébés
if (ageStr.includes('mois')) {
    bgColor = 'bg-blue-100';      // Au lieu de purple
    textColor = 'text-blue-700';
    icon = '👼';                   // Icône différente
}
```

## Export CSV

L'âge est exporté tel quel dans le CSV (format string) :
- "3 semaines"
- "6 mois"
- "25 ans"

Cela permet une analyse ultérieure tout en conservant la précision.
