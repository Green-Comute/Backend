import { useState } from 'react';
import PropTypes from 'prop-types';

const RideRequestCard = ({ rideRequest, onDecision }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDecision = async (decision) => {
    setIsProcessing(true);
    try {
      await onDecision(rideRequest._id, decision);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {rideRequest.passengerId?.name || 'Unknown Passenger'}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {rideRequest.passengerId?.email}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(rideRequest.status)}`}>
          {rideRequest.status}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center text-sm text-gray-600">
          <svg
            className="w-4 h-4 mr-2"
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
          {rideRequest.tripId?.source} → {rideRequest.tripId?.destination}
        </div>

        <div className="flex items-center text-sm text-gray-600">
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Requested: {new Date(rideRequest.createdAt).toLocaleString()}
        </div>
      </div>

      {rideRequest.status === 'PENDING' && (
        <div className="flex space-x-3">
          <button
            onClick={() => handleDecision('APPROVED')}
            disabled={isProcessing}
            className="flex-1 py-2 px-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Processing...' : 'Approve'}
          </button>
          <button
            onClick={() => handleDecision('REJECTED')}
            disabled={isProcessing}
            className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Processing...' : 'Reject'}
          </button>
        </div>
      )}
    </div>
  );
};

RideRequestCard.propTypes = {
  rideRequest: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
    createdAt: PropTypes.string.isRequired,
    passengerId: PropTypes.shape({
      name: PropTypes.string,
      email: PropTypes.string,
    }),
    tripId: PropTypes.shape({
      source: PropTypes.string,
      destination: PropTypes.string,
    }),
  }).isRequired,
  onDecision: PropTypes.func.isRequired,
};

export default RideRequestCard;
