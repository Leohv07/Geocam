// components/PhotoThumb.tsx — miniatura que distingue visualmente cámara vs. galería
import { View, Text, Image } from 'react-native';
import type { GeoPhoto } from '@/types/geo';

interface Props {
  photo: GeoPhoto;
  size?: 'sm' | 'md';
}

export function PhotoThumb({ photo, size = 'md' }: Props) {
  const isGallery = photo.source === 'gallery';
  const box = size === 'sm' ? 'h-14 w-14' : 'h-20 w-20';

  return (
    <View>
      <Image
        source={{ uri: photo.uri }}
        className={`${box} rounded-lg border-2 ${isGallery ? 'border-sky-400' : 'border-emerald-400'}`}
      />
      <View
        className={`absolute -bottom-1 -right-1 rounded-full px-1.5 ${isGallery ? 'bg-sky-400' : 'bg-emerald-400'}`}
      >
        <Text className="text-[10px] font-bold text-neutral-950">{isGallery ? 'GAL' : 'CAM'}</Text>
      </View>
    </View>
  );
}
