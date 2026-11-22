import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';

/** iOS loads Inter at startup: it names embedded fonts by their PostScript names, which the styles don't use. */
export const FONTS: Record<string, number> = { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold };
