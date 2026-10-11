import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, Text, View, type TextProps, type ViewProps } from 'react-native';

import { Fonts } from '@/constants/theme';
import { Espacamento, Raio, type CoresTema } from '@/constants/tokens';
import { useCores } from '@/hooks/use-cores';

const ICONES = {
  logo: { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' },
  pedidos: { ios: 'list.bullet.rectangle', android: 'receipt_long', web: 'receipt_long' },
  estoque: { ios: 'shippingbox', android: 'inventory_2', web: 'inventory_2' },
  relatorios: { ios: 'chart.bar', android: 'bar_chart', web: 'bar_chart' },
  rotas: { ios: 'arrow.triangle.swap', android: 'route', web: 'route' },
  camadas: { ios: 'square.stack.3d.up', android: 'layers', web: 'layers' },
  ajuda: { ios: 'questionmark.circle', android: 'help', web: 'help' },
  sino: { ios: 'bell', android: 'notifications', web: 'notifications' },
  mais: { ios: 'plus', android: 'add', web: 'add' },
  seta: { ios: 'chevron.down', android: 'keyboard_arrow_down', web: 'keyboard_arrow_down' },
  busca: { ios: 'magnifyingglass', android: 'search', web: 'search' },
} as const satisfies Record<string, SymbolViewProps['name']>;

export type NomeIcone = keyof typeof ICONES;

export function Icone({ nome, cor, tamanho = 20 }: { nome: NomeIcone; cor?: string; tamanho?: number }) {
  const cores = useCores();
  return <SymbolView name={ICONES[nome]} size={tamanho} tintColor={cor ?? cores.textoPrincipal} />;
}

type TextoProps = TextProps & {
  tamanho?: number;
  peso?: 400 | 500 | 600 | 700;
  cor?: keyof CoresTema;
};

export function Texto({ tamanho = 14, peso = 400, cor = 'textoPrincipal', style, ...rest }: TextoProps) {
  const cores = useCores();
  return (
    <Text
      style={[
        { fontFamily: Fonts?.sans, fontSize: tamanho, fontWeight: peso, color: cores[cor] },
        style,
      ]}
      {...rest}
    />
  );
}

/** Etiqueta com um ponto colorido, usada para status, canal e situação da loja. */
export function Etiqueta({ rotulo, corPonto }: { rotulo: string; corPonto: string }) {
  const cores = useCores();
  return (
    <View style={[styles.etiqueta, { borderColor: cores.borda, backgroundColor: cores.superficie }]}>
      <View style={[styles.ponto, { backgroundColor: corPonto }]} />
      <Texto peso={500}>{rotulo}</Texto>
    </View>
  );
}

export function Cartao({ style, ...rest }: ViewProps) {
  const cores = useCores();
  return (
    <View
      style={[styles.cartao, { borderColor: cores.borda, backgroundColor: cores.superficie }, style]}
      {...rest}
    />
  );
}

export function Divisor() {
  const cores = useCores();
  return <View style={{ height: 1, backgroundColor: cores.borda }} />;
}

const styles = StyleSheet.create({
  etiqueta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espacamento.small,
    paddingHorizontal: Espacamento.small,
    height: 28,
    borderWidth: 1,
    borderRadius: Raio.small,
  },
  ponto: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cartao: {
    borderWidth: 1,
    borderRadius: Raio.medium,
    padding: Espacamento.large,
  },
});
