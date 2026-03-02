import { useState, useEffect } from 'react';
import { tripService } from '../../services/tripService';
import { rideService } from '../../services/rideService';
import TripCard from '../../components/TripCard';
import LocationAutocomplete from '../../components/LocationAutocomplete';
import MapView from '../../components/MapView';
import { io } from 'socket.io-client';

const SearchTrips = () => {
  const [searchParams, setSearchParams] = useState({
    source: '',
    destination: '',
    vehicleType: '',
  });

  const [sourceLocation, setSourceLocation] = useState(null);
  const [destinationLocation, setDestinationLocation] = useState(null);

  const [trips, setTrips] = useState([]);
  const [requestedTripIds, setRequestedTripIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // Fetch passenger's requested rides on mount
  useEffect(() => {
    fetchPassengerRides();
  }, []);

  // Setup socket for real-time trip updates
  useEffect(() => {
    if (!hasSearched) return;

    const token = localStorage.getItem('authToken');
    const socket = io('http://localhost:5000', {
      auth: { token }
    });

    socket.on('connect', () => {
      console.log('Connected to socket for trip updates');
    });

    // Listen for new trips being created
    socket.on('new-trip-created', (data) => {
      console.log('New trip created:', data);
      // Refresh search results if we have search params
      if (searchParams.source && searchParams.destination) {
        const searchData = { ...searchParams };
        if (sourceLocation?.lat && sourceLocation?.lng) {
          searchData.sourceLat = sourceLocation.lat;
          searchData.sourceLng = sourceLocation.lng;
        }
        if (destinationLocation?.lat && destinationLocation?.lng) {
          searchData.destLat = destinationLocation.lat;
          searchData.destLng = destinationLocation.lng;
        }
        tripService.searchTrips(searchData)
          .then(data => setTrips(data.trips || []))
          .catch(err => console.error('Failed to refresh trips:', err));
      }
    });

    // Listen for trip seats updates
    socket.on('trip-seats-updated', (data) => {
      console.log('Trip seats updated:', data);
      // Update the specific trip in the list
      setTrips(prevTrips =>
        prevTrips.map(trip =>
          trip._id === data.tripId
            ? { ...trip, availableSeats: data.availableSeats }
            : trip
        )
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [hasSearched, searchParams, sourceLocation, destinationLocation]);

  const fetchPassengerRides = async () => {
    try {
      const data = await rideService.getPassengerRides();
      // Extract trip IDs from passenger's rides
      const requestedIds = (data.rides || []).map(ride => ride.trip?._id || ride.tripId).filter(Boolean);
      setRequestedTripIds(requestedIds);
    } catch (err) {
      console.error('Failed to fetch passenger rides:', err);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();

    if (!searchParams.source || !searchParams.destination) {
      setError('Please enter both source and destination');
      return;
    }

    setError('');
    setSuccessMessage('');
    setLoading(true);
    setHasSearched(true);

    try {
      // Build search params with location data if available
      const searchData = {
        ...searchParams
      };

      // Add geolocation data if available
      if (sourceLocation?.lat && sourceLocation?.lng) {
        searchData.sourceLat = sourceLocation.lat;
        searchData.sourceLng = sourceLocation.lng;
      }

      if (destinationLocation?.lat && destinationLocation?.lng) {
        searchData.destLat = destinationLocation.lat;
        searchData.destLng = destinationLocation.lng;
      }

      const data = await tripService.searchTrips(searchData);
      setTrips(data.trips || []);

      if (!data.trips || data.trips.length === 0) {
        setError('No trips found matching your search criteria');
      }
    } catch (err) {
      setError(err.message || 'Failed to search trips');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRide = async (tripId) => {
    try {
      setError('');
      setSuccessMessage('');

      await rideService.requestRide(tripId);

      setSuccessMessage('Ride requested successfully! The driver will review your request.');
      setRequestedTripIds([...requestedTripIds, tripId]);

      // Refresh passenger rides list
      fetchPassengerRides();

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setError(err.message || 'Failed to request ride');
    }
  };

  const handleSourceChange = (locationData) => {
    setSourceLocation(locationData);
    setSearchParams({
      ...searchParams,
      source: locationData?.address ?? locationData
    });
  };

  const handleDestinationChange = (locationData) => {
    setDestinationLocation(locationData);
    setSearchParams({
      ...searchParams,
      destination: locationData?.address ?? locationData
    });
  };

  const handleVehicleTypeFilter = (type) => {
    setSearchParams({
      ...searchParams,
      vehicleType: searchParams.vehicleType === type ? '' : type,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Search Trips</h1>
          <p className="text-gray-600 mt-2">Find available rides for your journey</p>
        </div>

        {/* Search Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <LocationAutocomplete
                label="Source"
                value={searchParams.source}
                onChange={handleSourceChange}
                placeholder="Enter pickup location"
                required
              />

              <LocationAutocomplete
                label="Destination"
                value={searchParams.destination}
                onChange={handleDestinationChange}
                placeholder="Enter destination"
                required
              />
            </div>

            {/* Vehicle Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vehicle Type (Optional)
              </label>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => handleVehicleTypeFilter('CAR')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${searchParams.vehicleType === 'CAR'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                  🚗 Car
                </button>
                <button
                  type="button"
                  onClick={() => handleVehicleTypeFilter('BIKE')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${searchParams.vehicleType === 'BIKE'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                  🏍️ Bike
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Searching...' : 'Search Trips'}
            </button>
          </form>
        </div>

        {/* Map View */}
        {((sourceLocation?.lat && sourceLocation?.lng) || (destinationLocation?.lat && destinationLocation?.lng)) && (
          <div className="mb-8">
            <div className="bg-white rounded-lg shadow-md p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Route Preview</h2>
              <MapView
                sourceLocation={sourceLocation}
                destinationLocation={destinationLocation}
                height="400px"
              />
              {sourceLocation && destinationLocation && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-start space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full mt-1 flex-shrink-0"></div>
                    <div>
                      <div className="font-medium text-gray-900">Pickup</div>
                      <div className="text-gray-600">{sourceLocation.address}</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full mt-1 flex-shrink-0"></div>
                    <div>
                      <div className="font-medium text-gray-900">Drop-off</div>
                      <div className="text-gray-600">{destinationLocation.address}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {successMessage}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Searching for trips...</p>
          </div>
        )}

        {/* Search Results */}
        {!loading && hasSearched && trips.length === 0 && !error && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <svg
              className="w-16 h-16 text-gray-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No trips found</h2>
            <p className="text-gray-600">Try adjusting your search criteria</p>
          </div>
        )}

        {!loading && trips.length > 0 && (
          <div>
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">
                Available Trips ({trips.length})
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trips.map((trip) => (
                <TripCard
                  key={trip._id}
                  trip={trip}
                  showRequestButton={true}
                  onRequestRide={handleRequestRide}
                  requestedTripIds={requestedTripIds}
                />
              ))}
            </div>
          </div>
        )}

        {/* Initial State - No Search Yet */}
        {!loading && !hasSearched && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <svg
              className="w-16 h-16 text-gray-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Start Your Search</h2>
            <p className="text-gray-600">Enter your source and destination to find available trips</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchTrips;
