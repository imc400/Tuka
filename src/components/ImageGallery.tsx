import React, { useState, useRef } from 'react';
import {
  View,
  Image,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  Platform,
} from 'react-native';

interface ImageGalleryProps {
  images: string[];
  fallbackImage?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_HEIGHT = SCREEN_WIDTH;

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  fallbackImage = 'https://via.placeholder.com/400x400.png?text=Producto',
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const displayImages = images.length > 0 ? images : [fallbackImage];

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / SCREEN_WIDTH);
    setActiveIndex(currentIndex);
  };

  const scrollToIndex = (index: number) => {
    scrollViewRef.current?.scrollTo({
      x: index * SCREEN_WIDTH,
      animated: true,
    });
    setActiveIndex(index);
  };

  return (
    <View style={styles.container}>
      {/* Main Image Carousel */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.mainScroll}
      >
        {displayImages.map((imageUrl, index) => (
          <View key={index} style={styles.imageContainer}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.mainImage}
              resizeMode="cover"
            />
          </View>
        ))}
      </ScrollView>

      {/* Pagination Dots */}
      {displayImages.length > 1 && (
        <View style={styles.pagination}>
          {displayImages.map((_, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => scrollToIndex(index)}
              style={styles.dotContainer}
            >
              <View
                style={[
                  styles.dot,
                  activeIndex === index && styles.activeDot,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Thumbnail Strip */}
      {displayImages.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.thumbnailScroll}
          contentContainerStyle={styles.thumbnailContainer}
        >
          {displayImages.map((imageUrl, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => scrollToIndex(index)}
              style={[
                styles.thumbnailWrapper,
                activeIndex === index && styles.activeThumbnail,
              ]}
            >
              <Image
                source={{ uri: imageUrl }}
                style={styles.thumbnail}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
  },
  mainScroll: {
    height: IMAGE_HEIGHT,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
    backgroundColor: '#f5f5f5',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  dotContainer: {
    padding: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ddd',
  },
  activeDot: {
    backgroundColor: '#000',
    width: 24,
  },
  thumbnailScroll: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  thumbnailContainer: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  thumbnailWrapper: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  activeThumbnail: {
    borderColor: '#000',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
});
