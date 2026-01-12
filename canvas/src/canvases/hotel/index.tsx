// Hotel Canvas - Hotel comparison and booking

import React, { useState, useMemo } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import type { Hotel, RoomType, Review, Money } from '../../shared/types';
import { useTerminalSize, useNavigation } from '../../shared/hooks';
import { formatMoney, formatDate, truncate } from '../../shared/utils';

export interface HotelConfig {
  hotels: Hotel[];
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
  sortBy?: 'price' | 'rating' | 'stars' | 'distance';
  filters?: {
    minRating?: number;
    maxPrice?: number;
    amenities?: string[];
  };
}

export interface HotelResult {
  action: 'select' | 'book' | 'compare' | 'filter';
  hotelId?: string;
  hotel?: Hotel;
  roomType?: RoomType;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
}

export interface HotelProps {
  config: HotelConfig;
  onResult?: (result: HotelResult) => void;
}

const AMENITY_ICONS: Record<string, string> = {
  wifi: '📶',
  pool: '🏊',
  gym: '💪',
  spa: '🧖',
  restaurant: '🍽️',
  bar: '🍸',
  parking: '🅿️',
  'room-service': '🛎️',
  'air-conditioning': '❄️',
  breakfast: '🍳',
  'pet-friendly': '🐕',
  'business-center': '💼',
};

export function HotelCanvas({ config, onResult }: HotelProps): React.ReactElement {
  const { width, height } = useTerminalSize();
  const { exit } = useApp();
  const { hotels, checkIn, checkOut, guests, rooms, sortBy = 'price', filters } = config;

  const [selectedHotel, setSelectedHotel] = useState(0);
  const [selectedRoom, setSelectedRoom] = useState(0);
  const [view, setView] = useState<'list' | 'details' | 'rooms'>('list');
  const [compareMode, setCompareMode] = useState(false);
  const [compareList, setCompareList] = useState<string[]>([]);

  // Calculate nights
  const nights = Math.ceil(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Sort and filter hotels
  const sortedHotels = useMemo(() => {
    let result = [...hotels];

    // Apply filters
    if (filters) {
      if (filters.minRating) {
        result = result.filter(h => h.rating >= filters.minRating!);
      }
      if (filters.maxPrice) {
        result = result.filter(h => h.pricePerNight.amount <= filters.maxPrice!);
      }
      if (filters.amenities && filters.amenities.length > 0) {
        result = result.filter(h =>
          filters.amenities!.every(a => h.amenities.includes(a))
        );
      }
    }

    // Sort
    switch (sortBy) {
      case 'price':
        result.sort((a, b) => a.pricePerNight.amount - b.pricePerNight.amount);
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'stars':
        result.sort((a, b) => b.stars - a.stars);
        break;
    }

    return result;
  }, [hotels, sortBy, filters]);

  const currentHotel = sortedHotels[selectedHotel];
  const currentRoom = currentHotel?.roomTypes[selectedRoom];

  useInput((input, key) => {
    if (key.escape) {
      if (view !== 'list') {
        setView('list');
      } else if (compareMode) {
        setCompareMode(false);
        setCompareList([]);
      } else {
        exit();
      }
      return;
    }

    // Navigation
    if (view === 'list' || view === 'details') {
      if (key.upArrow) {
        setSelectedHotel(h => Math.max(0, h - 1));
        setSelectedRoom(0);
      }
      if (key.downArrow) {
        setSelectedHotel(h => Math.min(sortedHotels.length - 1, h + 1));
        setSelectedRoom(0);
      }
    }

    if (view === 'rooms') {
      if (key.upArrow) {
        setSelectedRoom(r => Math.max(0, r - 1));
      }
      if (key.downArrow) {
        setSelectedRoom(r => Math.min((currentHotel?.roomTypes.length || 1) - 1, r + 1));
      }
    }

    // View switching
    if (key.return) {
      if (view === 'list') {
        setView('details');
      } else if (view === 'details') {
        setView('rooms');
      } else if (view === 'rooms' && currentRoom) {
        onResult?.({
          action: 'book',
          hotelId: currentHotel.id,
          hotel: currentHotel,
          roomType: currentRoom,
          checkIn,
          checkOut,
          guests,
          rooms,
        });
      }
    }

    // Compare mode
    if (input === 'c') {
      if (!compareMode) {
        setCompareMode(true);
      } else if (currentHotel) {
        const id = currentHotel.id;
        if (compareList.includes(id)) {
          setCompareList(compareList.filter(i => i !== id));
        } else if (compareList.length < 3) {
          setCompareList([...compareList, id]);
        }
      }
    }

    // View compare results
    if (input === 'C' && compareList.length >= 2) {
      onResult?.({
        action: 'compare',
        checkIn,
        checkOut,
        guests,
        rooms,
      });
    }

    // Quick select
    if (input === 'b' && currentHotel) {
      setView('rooms');
    }

    // Filter
    if (input === 'f') {
      onResult?.({
        action: 'filter',
        checkIn,
        checkOut,
        guests,
        rooms,
      });
    }
  });

  // Render star rating
  const renderStars = (count: number) => '★'.repeat(count) + '☆'.repeat(5 - count);

  // Render hotel card in list view
  const renderHotelCard = (hotel: Hotel, index: number, isSelected: boolean) => {
    const isComparing = compareList.includes(hotel.id);
    const totalPrice = hotel.pricePerNight.amount * nights * rooms;

    return (
      <Box
        key={hotel.id}
        flexDirection="column"
        borderStyle={isSelected ? 'bold' : 'single'}
        borderColor={isComparing ? 'yellow' : isSelected ? 'cyan' : 'gray'}
        width={width - 4}
        paddingX={1}
      >
        <Box justifyContent="space-between">
          <Box>
            {isComparing && <Text color="yellow">[C] </Text>}
            <Text bold>{truncate(hotel.name, 35)}</Text>
            <Text dimColor> {hotel.chain && `(${hotel.chain})`}</Text>
          </Box>
          <Text color="yellow">{renderStars(hotel.stars)}</Text>
        </Box>

        <Box justifyContent="space-between">
          <Text dimColor>{hotel.location.city}, {hotel.location.country}</Text>
          <Box>
            <Text color="green" bold>{formatMoney(hotel.pricePerNight)}</Text>
            <Text dimColor>/night</Text>
          </Box>
        </Box>

        <Box justifyContent="space-between">
          <Box gap={1}>
            <Text>Rating: <Text color={hotel.rating >= 4 ? 'green' : hotel.rating >= 3 ? 'yellow' : 'red'}>{hotel.rating.toFixed(1)}</Text>/5</Text>
            {hotel.reviews && <Text dimColor>({hotel.reviews.length} reviews)</Text>}
          </Box>
          <Text dimColor>Total: <Text color="green">{formatMoney({ amount: totalPrice, currency: hotel.pricePerNight.currency })}</Text></Text>
        </Box>

        {/* Amenities */}
        <Box gap={1} marginTop={0}>
          {hotel.amenities.slice(0, 8).map(amenity => (
            <Text key={amenity} dimColor>
              {AMENITY_ICONS[amenity] || '•'}{' '}
            </Text>
          ))}
        </Box>
      </Box>
    );
  };

  // Render hotel details view
  const renderDetails = () => {
    if (!currentHotel) return null;

    return (
      <Box flexDirection="column" gap={1}>
        {/* Header */}
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
          <Text bold color="cyan">{currentHotel.name}</Text>
          <Text>{currentHotel.chain && `${currentHotel.chain} | `}{renderStars(currentHotel.stars)}</Text>
          <Text dimColor>{currentHotel.location.address}</Text>
          <Text dimColor>{currentHotel.location.city}, {currentHotel.location.country}</Text>
        </Box>

        {/* Rating & Price */}
        <Box justifyContent="space-around" borderStyle="single" padding={1}>
          <Box flexDirection="column" alignItems="center">
            <Text bold color={currentHotel.rating >= 4 ? 'green' : 'yellow'}>
              {currentHotel.rating.toFixed(1)}/5
            </Text>
            <Text dimColor>{currentHotel.reviews?.length || 0} reviews</Text>
          </Box>
          <Box flexDirection="column" alignItems="center">
            <Text bold color="green">{formatMoney(currentHotel.pricePerNight)}</Text>
            <Text dimColor>per night</Text>
          </Box>
          <Box flexDirection="column" alignItems="center">
            <Text bold>{nights} nights</Text>
            <Text dimColor>{formatDate(checkIn, 'short')} - {formatDate(checkOut, 'short')}</Text>
          </Box>
        </Box>

        {/* Amenities */}
        <Box flexDirection="column" borderStyle="single" padding={1}>
          <Text bold>Amenities</Text>
          <Box flexWrap="wrap" gap={2}>
            {currentHotel.amenities.map(amenity => (
              <Text key={amenity}>
                {AMENITY_ICONS[amenity] || '•'} {amenity}
              </Text>
            ))}
          </Box>
        </Box>

        {/* Policies */}
        {currentHotel.policies && (
          <Box flexDirection="column" borderStyle="single" padding={1}>
            <Text bold>Policies</Text>
            <Text>Check-in: {currentHotel.policies.checkIn}</Text>
            <Text>Check-out: {currentHotel.policies.checkOut}</Text>
            <Text>Cancellation: {currentHotel.policies.cancellation}</Text>
            <Text>Pets: {currentHotel.policies.petsAllowed ? 'Allowed' : 'Not allowed'}</Text>
          </Box>
        )}

        {/* Recent reviews */}
        {currentHotel.reviews && currentHotel.reviews.length > 0 && (
          <Box flexDirection="column" borderStyle="single" padding={1}>
            <Text bold>Recent Reviews</Text>
            {currentHotel.reviews.slice(0, 3).map(review => (
              <Box key={review.id} flexDirection="column" marginTop={1}>
                <Box>
                  <Text color="yellow">{'★'.repeat(review.rating)}</Text>
                  <Text dimColor> {review.author} - {formatDate(review.date, 'short')}</Text>
                </Box>
                {review.title && <Text bold>{review.title}</Text>}
                <Text dimColor>{truncate(review.content, 80)}</Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    );
  };

  // Render room selection view
  const renderRooms = () => {
    if (!currentHotel) return null;

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color="cyan">Select Room - {currentHotel.name}</Text>
        </Box>

        {currentHotel.roomTypes.map((room, index) => {
          const isSelected = index === selectedRoom;
          const totalPrice = room.pricePerNight.amount * nights * rooms;

          return (
            <Box
              key={room.id}
              flexDirection="column"
              borderStyle={isSelected ? 'bold' : 'single'}
              borderColor={isSelected ? 'cyan' : room.available ? 'gray' : 'red'}
              padding={1}
              marginBottom={1}
            >
              <Box justifyContent="space-between">
                <Text bold={isSelected}>{room.name}</Text>
                <Text color={room.available ? 'green' : 'red'}>
                  {room.available ? 'Available' : 'Sold Out'}
                </Text>
              </Box>

              <Text dimColor>{room.description}</Text>

              <Box justifyContent="space-between" marginTop={1}>
                <Box gap={2}>
                  <Text>🛏️ {room.bedType}</Text>
                  <Text>👥 Max {room.maxOccupancy}</Text>
                </Box>
                <Box>
                  <Text bold color="green">{formatMoney(room.pricePerNight)}</Text>
                  <Text dimColor>/night</Text>
                </Box>
              </Box>

              <Box gap={1}>
                {room.amenities.slice(0, 5).map(amenity => (
                  <Text key={amenity} dimColor>{amenity}</Text>
                ))}
              </Box>

              <Box justifyContent="flex-end">
                <Text dimColor>Total: </Text>
                <Text bold color="green">
                  {formatMoney({ amount: totalPrice, currency: room.pricePerNight.currency })}
                </Text>
              </Box>
            </Box>
          );
        })}
      </Box>
    );
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Box flexDirection="column">
          <Text bold color="cyan">Hotel Search</Text>
          <Text dimColor>
            {formatDate(checkIn, 'short')} → {formatDate(checkOut, 'short')}
            {' | '}{nights} nights | {guests} guests | {rooms} room{rooms > 1 ? 's' : ''}
          </Text>
        </Box>
        <Box gap={2}>
          <Text inverse={view === 'list'}> List </Text>
          <Text inverse={view === 'details'}> Details </Text>
          <Text inverse={view === 'rooms'}> Rooms </Text>
        </Box>
      </Box>

      {/* Content */}
      {view === 'list' && (
        <Box flexDirection="column" gap={1}>
          <Text dimColor>{sortedHotels.length} hotels found | Sorted by {sortBy}</Text>
          {sortedHotels.slice(0, 5).map((hotel, index) =>
            renderHotelCard(hotel, index, index === selectedHotel)
          )}
        </Box>
      )}
      {view === 'details' && renderDetails()}
      {view === 'rooms' && renderRooms()}

      {/* Compare panel */}
      {compareMode && compareList.length > 0 && (
        <Box borderStyle="single" borderColor="yellow" padding={1} marginTop={1}>
          <Text color="yellow">
            Comparing: {compareList.map(id => {
              const h = hotels.find(h => h.id === id);
              return h?.name;
            }).join(', ')}
            {compareList.length >= 2 && ' | Press C to compare'}
          </Text>
        </Box>
      )}

      {/* Footer */}
      <Box marginTop={1} gap={2}>
        <Text dimColor><Text bold>↑↓</Text> navigate</Text>
        <Text dimColor><Text bold>Enter</Text> {view === 'rooms' ? 'book' : 'select'}</Text>
        <Text dimColor><Text bold>c</Text> compare</Text>
        <Text dimColor><Text bold>b</Text> book</Text>
        <Text dimColor><Text bold>f</Text> filter</Text>
        <Text dimColor><Text bold>ESC</Text> back</Text>
      </Box>
    </Box>
  );
}

export default HotelCanvas;
