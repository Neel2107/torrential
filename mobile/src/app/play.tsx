import { Text, View } from 'react-native';

import { color, type } from '@/theme';

export default function Screen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.paper }}>
      <Text style={type.title}>play</Text>
    </View>
  );
}
