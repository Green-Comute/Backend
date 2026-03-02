import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tripService } from '../../services/tripService';
import { rideService } from '../../services/rideService';
import LiveTrackingMap from '../../components/LiveTrackingMap';
import { io } from 'socket.io-client';

const ActiveTrip = () => {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [pickupLoading, setPickupLoading] = useState({});
  const [passengerCancelAlert, setPassengerCancelAlert] = useState(null);

  // Get user from localStorage - try multiple keys
  const getUserData = () => {
    try {
      // Try 'user' key first
      const userStr = localStorage.getItem('user');
      if (userStr && userStr !== '{}') {
        return JSON.parse(userStr);
      }

      // Try decoding JWT token
      const token = localStorage.getItem('authToken');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload;
      }

      return {};
    } catch (err) {
      console.error('Error getting user data:', err);
      return {};
    }
  };

  const user = getUserData();

  useEffect(() => {
    fetchTripDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  // Socket connection: listen for passenger cancellations
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const socket = io('http://localhost:5000', { auth: { token } });

    socket.on('ride-cancelled-by-passenger', (data) => {
      setPassengerCancelAlert(data.message || 'A passenger has cancelled their ride.');
      // Auto-clear after 6 seconds
      setTimeout(() => setPassengerCancelAlert(null), 6000);
      // Refresh trip details to update passenger list
      fetchTripDetails();
    });

    return () => socket.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTripDetails = async () => {
    try {
      setLoading(true);
      const data = await tripService.getTripById(tripId);
      setTrip(data.trip);
    } catch (err) {
      setError(err.message || 'Failed to load trip details');
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrip = async () => {
    try {
      setActionLoading(true);
      setError('');
      await tripService.startTrip(tripId);
      await fetchTripDetails(); // Refresh trip data
    } catch (err) {
      setError(err.message || 'Failed to start trip');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteTrip = async () => {
    if (!window.confirm('Are you sure you want to complete this trip?')) {
      return;
    }

    try {
      setActionLoading(true);
      setError('');
      await tripService.completeTrip(tripId);
      await fetchTripDetails(); // Refresh trip data

      // Redirect after 2 seconds
      setTimeout(() => {
        navigate('/driver/requests');
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to complete trip');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelTrip = async () => {
    if (!window.confirm('Are you sure you want to cancel this trip? This action cannot be undone.')) {
      return;
    }

    try {
      setActionLoading(true);
      setError('');
      await tripService.cancelTrip(tripId);

      // Redirect to driver dashboard
      setTimeout(() => {
        navigate('/driver/requests');
      }, 1000);
    } catch (err) {
      setError(err.message || 'Failed to cancel trip');
    } finally {
      setActionLoading(false);
    }
  };
  const handlePickup = async (rideId) => {
    try {
      setPickupLoading(prev => ({ ...prev, [rideId]: true }));
      setError('');
      await rideService.markAsPickedUp(rideId);
      await fetchTripDetails(); // Refresh trip data
    } catch (err) {
      setError(err.message || 'Failed to mark as picked up');
    } finally {
      setPickupLoading(prev => ({ ...prev, [rideId]: false }));
    }
  };

  const handleDropoff = async (rideId) => {
    try {
      setPickupLoading(prev => ({ ...prev, [rideId]: true }));
      setError('');
      await rideService.markAsDroppedOff(rideId);
      await fetchTripDetails(); // Refresh trip data
    } catch (err) {
      setError(err.message || 'Failed to mark as dropped off');
    } finally {
      setPickupLoading(prev => ({ ...prev, [rideId]: false }));
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading trip details...</p>
        </div>
      </div>
    );
  }

  if (error && !trip) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="text-red-600 text-5xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Trip</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/driver/requests')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Trips
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check if current user is the driver
  const driverIdString = trip.driverId?._id?.toString() || trip.driverId?.toString();
  const userIdString = user.userId?.toString() || user.id?.toString();
  const isDriver = driverIdString === userIdString;

  console.log('Driver Check:', {
    driverIdString,
    userIdString,
    isDriver,
    tripStatus: trip.status,
    user
  });

  const approvedPassengers = (trip.rides || []).filter(ride => ride.status === 'APPROVED');

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Trip Details</h1>
            <p className="text-gray-600 mt-1">
              {trip.status === 'STARTED' ? 'Trip in progress' : `Trip ${trip.status.toLowerCase()}`}
            </p>
          </div>
          <button
            onClick={() => navigate('/driver/requests')}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            ← Back to Trips
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Passenger cancelled alert */}
        {passengerCancelAlert && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-lg flex items-start space-x-3">
            <span className="text-amber-500 text-xl">ℹ️</span>
            <div>
              <p className="font-semibold text-amber-800">Passenger Cancellation</p>
              <p className="text-amber-700 text-sm mt-1">{passengerCancelAlert}</p>
            </div>
          </div>
        )}

        {/* Trip Info Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Route Information</h3>
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-600">From:</span>
                  <p className="font-medium text-gray-900">{trip.source}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">To:</span>
                  <p className="font-medium text-gray-900">{trip.destination}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Scheduled Time:</span>
                  <p className="font-medium text-gray-900">
                    {new Date(trip.scheduledTime).toLocaleString()}
                  </p>
                </div>
                {trip.actualStartTime && (
                  <div>
                    <span className="text-sm text-gray-600">Started At:</span>
                    <p className="font-medium text-gray-900">
                      {new Date(trip.actualStartTime).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Trip Details</h3>
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-600">Vehicle Type:</span>
                  <p className="font-medium text-gray-900">{trip.vehicleType}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Total Seats:</span>
                  <p className="font-medium text-gray-900">{trip.totalSeats}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Passengers:</span>
                  <p className="font-medium text-gray-900">
                    {approvedPassengers.length} / {trip.totalSeats}
                  </p>
                </div>

                {isDriver && trip.status === 'SCHEDULED' && (
                  <div className="pt-3">
                    <button
                      onClick={handleStartTrip}
                      disabled={actionLoading}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
                    >
                      {actionLoading ? 'Starting...' : '🚀 Start Trip'}
                    </button>
                  </div>
                )}
                {isDriver && trip.status === 'STARTED' && (
                  <div className="pt-3">
                    <button
                      onClick={handleCompleteTrip}
                      disabled={actionLoading}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                    >
                      {actionLoading ? 'Completing...' : '✓ Complete Trip'}
                    </button>
                  </div>
                )}
                {isDriver && trip.status === 'SCHEDULED' && (
                  <div>
                    <button
                      onClick={handleCancelTrip}
                      disabled={actionLoading}
                      className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400"
                    >
                      {actionLoading ? 'Cancelling...' : 'Cancel Trip'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Passengers List */}
        {approvedPassengers.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">
              Passengers ({approvedPassengers.length})
            </h3>
            <div className="space-y-3">
              {approvedPassengers.map((ride) => (
                <div key={ride._id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${ride.pickupStatus === 'DROPPED_OFF'
                        ? 'bg-gray-100'
                        : ride.pickupStatus === 'PICKED_UP'
                          ? 'bg-green-100'
                          : 'bg-blue-100'
                        }`}>
                        <span className={`font-semibold ${ride.pickupStatus === 'DROPPED_OFF'
                          ? 'text-gray-700'
                          : ride.pickupStatus === 'PICKED_UP'
                            ? 'text-green-700'
                            : 'text-blue-700'
                          }`}>
                          {(ride.passengerId?.name || 'P')[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <p className="font-medium text-gray-900">
                            {ride.passengerId?.name || 'Passenger'}
                          </p>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ride.pickupStatus === 'DROPPED_OFF'
                            ? 'bg-gray-100 text-gray-700'
                            : ride.pickupStatus === 'PICKED_UP'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-amber-100 text-amber-700'
                            }`}>
                            {ride.pickupStatus === 'DROPPED_OFF' ? '✓ Dropped Off' :
                              ride.pickupStatus === 'PICKED_UP' ? '✓ On Board' :
                                '⏳ Waiting'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {ride.passengerId?.email || 'No email'}
                        </p>
                        {ride.passengerId?.phone && (
                          <p className="text-sm text-gray-600">
                            📞 {ride.passengerId.phone}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Pickup/Dropoff Buttons */}
                    {isDriver && trip.status === 'STARTED' && (
                      <div className="ml-3 flex flex-col space-y-2">
                        {ride.pickupStatus === 'WAITING' && (
                          <button
                            onClick={() => handlePickup(ride._id)}
                            disabled={pickupLoading[ride._id]}
                            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors disabled:bg-gray-400 whitespace-nowrap"
                          >
                            {pickupLoading[ride._id] ? '...' : '✓ Pick Up'}
                          </button>
                        )}
                        {ride.pickupStatus === 'PICKED_UP' && (
                          <button
                            onClick={() => handleDropoff(ride._id)}
                            disabled={pickupLoading[ride._id]}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors disabled:bg-gray-400 whitespace-nowrap"
                          >
                            {pickupLoading[ride._id] ? '...' : '✓ Drop Off'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Tracking Map */}
        <LiveTrackingMap
          trip={trip}
          userRole={isDriver ? 'driver' : 'passenger'}
        />
      </div>
    </div>
  );
};

export default ActiveTrip;
