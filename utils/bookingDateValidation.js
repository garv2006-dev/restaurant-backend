/**
 * Booking Date Validation Utilities
 * Handles night-based hotel booking validation
 * - No hourly bookings
 * - Same-day check-in and check-out NOT allowed
 * - No past dates
 * - Fixed hotel timings: Check-in 2:00 PM, Check-out 11:00 AM
 */

/**
 * Normalize date to midnight (00:00:00)
 * Used for consistent date comparisons
 */
const normalizeToMidnight = (date) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

/**
 * Validate booking dates for night-only stays
 * @param {Date} checkInDate - The check-in date
 * @param {Date} checkOutDate - The check-out date
 * @returns {Object} { isValid: boolean, error: string|null }
 */
const validateBookingDates = (checkInDate, checkOutDate) => {
  const checkIn = normalizeToMidnight(new Date(checkInDate));
  const checkOut = normalizeToMidnight(new Date(checkOutDate));
  const today = normalizeToMidnight(new Date());

  // Check 1: Check-in date cannot be in the past
  if (checkIn < today) {
    return {
      isValid: false,
      error: 'Check-in date cannot be in the past'
    };
  }

  // Check 2: Check-out date must be in the future (at least tomorrow if check-in is today)
  if (checkOut <= today) {
    return {
      isValid: false,
      error: 'Check-out date must be in the future'
    };
  }

  // Check 3: Check-out date must be greater than check-in date (not same day)
  if (checkOut <= checkIn) {
    return {
      isValid: false,
      error: 'Same-day check-in and check-out is NOT allowed. Check-out date must be greater than check-in date'
    };
  }

  // Check 4: Calculate number of nights (must be at least 1)
  const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
  if (nights < 1) {
    return {
      isValid: false,
      error: 'Minimum 1 night required for booking'
    };
  }

  return {
    isValid: true,
    error: null,
    nights
  };
};

/**
 * Check if two bookings overlap using the specified overlap formula
 * existingCheckInDate < newCheckOutDate AND existingCheckOutDate > newCheckInDate
 * @param {Date} existingCheckIn - Existing booking check-in
 * @param {Date} existingCheckOut - Existing booking check-out
 * @param {Date} newCheckIn - New booking check-in
 * @param {Date} newCheckOut - New booking check-out
 * @returns {boolean} true if overlap exists, false otherwise
 */
const checkDateOverlap = (existingCheckIn, existingCheckOut, newCheckIn, newCheckOut) => {
  const existingIn = normalizeToMidnight(new Date(existingCheckIn));
  const existingOut = normalizeToMidnight(new Date(existingCheckOut));
  const newIn = normalizeToMidnight(new Date(newCheckIn));
  const newOut = normalizeToMidnight(new Date(newCheckOut));

  // Overlap exists if: existingCheckIn < newCheckOut AND existingCheckOut > newCheckIn
  return existingIn < newOut && existingOut > newIn;
};

/**
 * Format booking dates for display (e.g., "27 Feb 2026")
 */
const formatBookingDate = (date) => {
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

/**
 * Get hotel check-in time string
 */
const getHotelCheckInTime = () => '2:00 PM';

/**
 * Get hotel check-out time string
 */
const getHotelCheckOutTime = () => '11:00 AM';

/**
 * Generate booking dates summary with fixed hotel timings
 */
const generateBookingDatesSummary = (checkInDate, checkOutDate, nights) => {
  const checkInFormatted = formatBookingDate(checkInDate);
  const checkOutFormatted = formatBookingDate(checkOutDate);

  return {
    checkIn: {
      date: checkInFormatted,
      time: getHotelCheckInTime(),
      display: `${checkInFormatted} at ${getHotelCheckInTime()}`
    },
    checkOut: {
      date: checkOutFormatted,
      time: getHotelCheckOutTime(),
      display: `${checkOutFormatted} at ${getHotelCheckOutTime()}`
    },
    nights,
    summary: `${nights} night${nights > 1 ? 's' : ''} (${checkInFormatted} to ${checkOutFormatted})`,
    hotelTimingRules: {
      checkInTime: getHotelCheckInTime(),
      checkOutTime: getHotelCheckOutTime(),
      note: 'Check-out day morning is FREE for the next booking'
    }
  };
};

module.exports = {
  normalizeToMidnight,
  validateBookingDates,
  checkDateOverlap,
  formatBookingDate,
  getHotelCheckInTime,
  getHotelCheckOutTime,
  generateBookingDatesSummary
};
