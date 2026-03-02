import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { rideService } from "../../services/rideService";
import { io } from 'socket.io-client';
import { registerPasskey } from "../../services/passkeyService";

const EmployeeDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [passengerRides, setPassengerRides] = useState([]);
  const [ridesLoading, setRidesLoading] = useState(true);
  const [passkeyStatus, setPasskeyStatus] = useState(""); // feedback for passkey UI
  const [tripNotification, setTripNotification] = useState("");

  // 🔹 Fetch logged-in user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/users/me", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        setUser(data.user);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  // 🔹 Fetch passenger rides
  useEffect(() => {
    const fetchPassengerRides = async () => {
      try {
        setRidesLoading(true);
        const data = await rideService.getPassengerRides();
        setPassengerRides(data.rides || []);
      } catch (err) {
        console.error("Error fetching passenger rides:", err);
      } finally {
        setRidesLoading(false);
      }
    };

    if (user) {
      fetchPassengerRides();
    }
  }, [user]);

  // Setup socket for real-time ride status notifications
  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem('authToken');
    const socket = io('http://localhost:5000', {
      auth: { token }
    });

    socket.on('connect', () => {
      console.log('Connected to socket for ride notifications');
    });

    // Listen for ride approval/rejection
    socket.on('ride-approved-notification', (data) => {
      console.log('Ride approved:', data);
      // Refresh passenger rides
      rideService.getPassengerRides()
        .then(result => setPassengerRides(result.rides || []))
        .catch(err => console.error('Failed to refresh rides:', err));
    });

    socket.on('ride-rejected-notification', (data) => {
      console.log('Ride rejected:', data);
      // Refresh passenger rides
      rideService.getPassengerRides()
        .then(result => setPassengerRides(result.rides || []))
        .catch(err => console.error('Failed to refresh rides:', err));
    });

    socket.on('trip-cancelled', (data) => {
      console.log('Trip cancelled log:', data);
      setTripNotification(data.message || 'A trip you were on has been cancelled.');
      setTimeout(() => setTripNotification(""), 6000);
      rideService.getPassengerRides()
        .then(result => setPassengerRides(result.rides || []))
        .catch(err => console.error('Failed to refresh rides:', err));
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  // 🔹 Request driver access
  const requestDriver = async () => {
    setActionLoading(true);
    setMessage("");

    try {
      const res = await fetch(
        "http://localhost:5000/api/users/driver-intent",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setUser((prev) => ({
        ...prev,
        isDriver: true,
        driverStatus: "PENDING",
      }));

      setMessage("Driver request submitted. Upload documents next.");

      setTimeout(() => {
        navigate("/driver/upload");
      }, 1200);
    } catch (err) {
      setMessage(err.message || "Something went wrong");
    } finally {
      setActionLoading(false);
    }
  };

  // 🔑 Register a new passkey
  const handleRegisterPasskey = async () => {
    setPasskeyStatus("loading");
    const result = await registerPasskey();
    setPasskeyStatus(result.success ? "success" : "error");
    setTimeout(() => setPasskeyStatus(""), 4000);
  };

  if (loading) {
    return <p className="p-8">Loading dashboard...</p>;
  }

  // 🛡️ Safety guard
  if (!user) {
    return <p className="p-8 text-red-600">Failed to load user</p>;
  }

  return (
    <div className="p-8">
      {tripNotification && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-lg flex items-start space-x-3">
          <span className="text-amber-500 text-xl">ℹ️</span>
          <div>
            <p className="font-semibold text-amber-800">Trip Update</p>
            <p className="text-amber-700 text-sm mt-1">{tripNotification}</p>
          </div>
        </div>
      )}

      <h1 className="text-3xl font-bold text-stone-900 mb-2">
        Welcome to GreenCommute 🌱
      </h1>

      <p className="text-stone-600 mb-8">
        Start sharing rides with colleagues from your organization.
      </p>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Personal Details */}
        <div className="p-6 bg-white border rounded-xl shadow-sm">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            👤 Personal Details
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-600">Name:</span>
              <span className="font-medium">{user.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-600">Email:</span>
              <span className="font-medium text-xs">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-600">Role:</span>
              <span className="font-medium capitalize">{user.role}</span>
            </div>
            {user.phone && (
              <div className="flex justify-between">
                <span className="text-stone-600">Phone:</span>
                <span className="font-medium">{user.phone}</span>
              </div>
            )}
            {user.organizationId && (
              <div className="flex justify-between">
                <span className="text-stone-600">Organization:</span>
                <span className="font-medium text-xs">{user.organizationId}</span>
              </div>
            )}
            <div className="pt-2 border-t">
              <div className="flex justify-between items-center">
                <span className="text-stone-600">Profile:</span>
                <span className={`text-xs px-2 py-1 rounded ${user.profileCompleted
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
                  }`}>
                  {user.profileCompleted ? "Complete" : "Incomplete"}
                </span>
              </div>
            </div>
            {!user.profileCompleted && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-amber-600 mb-2">Required to complete:</p>
                <ul className="text-xs text-stone-600 space-y-1 ml-4 list-disc">
                  {!user.name && <li>Name</li>}
                  {!user.dob && <li>Date of Birth</li>}
                  {!user.gender && <li>Gender</li>}
                  {!user.homeAddress && <li>Home Address</li>}
                  {!user.workAddress && <li>Work Address</li>}
                </ul>
                <button
                  onClick={() => navigate("/complete-profile")}
                  className="mt-3 w-full px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm transition-colors"
                >
                  Complete Profile
                </button>
              </div>
            )}
            {user.isDriver && (
              <div className="flex justify-between items-center">
                <span className="text-stone-600">Driver Status:</span>
                <span className={`text-xs px-2 py-1 rounded ${user.driverStatus === "APPROVED"
                  ? "bg-green-100 text-green-700"
                  : user.driverStatus === "PENDING"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-gray-100 text-gray-700"
                  }`}>
                  {user.driverStatus || "N/A"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Find Rides */}
        <div className="p-6 bg-white border rounded-xl shadow-sm">
          <h3 className="font-semibold text-lg mb-2">🔍 Find Rides</h3>
          <p className="text-sm text-stone-600 mb-4">
            Search and book rides with colleagues along your route.
          </p>
          <button
            onClick={() => navigate("/passenger/search")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full"
          >
            Search Available Trips
          </button>
        </div>

        {/* Offer Ride */}
        <div className="p-6 bg-white border rounded-xl shadow-sm">
          <h3 className="font-semibold text-lg mb-2">🚗 Offer a Ride</h3>
          <p className="text-sm text-stone-600 mb-4">
            Create trips and share your commute to save emissions.
          </p>
          {user.driverStatus === "APPROVED" ? (
            <div className="space-y-2">
              <button
                onClick={() => navigate("/driver/create-trip")}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors w-full"
              >
                Create New Trip
              </button>
              <button
                onClick={() => navigate("/driver/requests")}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors w-full"
              >
                Manage Requests
              </button>
            </div>
          ) : (
            <p className="text-sm text-amber-600">
              {user.driverStatus === "PENDING"
                ? "⏳ Driver approval pending"
                : "Become an approved driver to offer rides"}
            </p>
          )}
        </div>

        {/* 🚗 Driver Card */}
        <div className="p-6 bg-white border rounded-xl shadow-sm">
          <h3 className="font-semibold text-lg mb-2">Become a Driver</h3>

          {/* NOT A DRIVER */}
          {!user.isDriver && (
            <>
              <p className="text-sm text-stone-600 mb-4">
                Offer rides to colleagues and reduce emissions.
              </p>
              <button
                onClick={requestDriver}
                disabled={actionLoading}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg"
              >
                {actionLoading ? "Submitting..." : "Request Driver Access"}
              </button>
            </>
          )}

          {/* DRIVER BUT NO DOCS */}
          {user.isDriver && !user.documentsUploaded && (
            <>
              <p className="text-sm text-stone-600 mb-4">
                Upload license & RC to continue
              </p>
              <button
                onClick={() => navigate("/driver/upload")}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg"
              >
                Upload Driver Documents
              </button>
            </>
          )}

          {/* DOCS UPLOADED, PENDING */}
          {user.driverStatus === "PENDING" && user.documentsUploaded && (
            <p className="text-emerald-700 font-medium mt-3">
              Driver request submitted. Awaiting approval.
            </p>
          )}

          {/* APPROVED */}
          {user.driverStatus === "APPROVED" && (
            <p className="text-emerald-700 font-semibold mt-3">
              ✅ You are an approved driver
            </p>
          )}

          {/* REJECTED */}
          {user.driverStatus === "REJECTED" && (
            <p className="text-red-600 mt-3">
              ❌ Rejected: {user.driverRejectionReason || "No reason provided"}
            </p>
          )}

          {message && (
            <p className="mt-3 text-sm text-emerald-700">{message}</p>
          )}
        </div>

        {/* 🔑 Security / Passkey */}
        <div className="p-6 bg-white border rounded-xl shadow-sm">
          <h3 className="font-semibold text-lg mb-2">🔑 Security</h3>
          <p className="text-sm text-stone-600 mb-4">
            Register a passkey (Touch ID / Face ID) so you can sign in without a password next time.
          </p>
          <button
            onClick={handleRegisterPasskey}
            disabled={passkeyStatus === "loading"}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {passkeyStatus === "loading" ? "Registering..." : "Register a Passkey"}
          </button>
          {passkeyStatus === "success" && (
            <p className="mt-2 text-sm text-emerald-600">✅ Passkey registered! Use it next time you log in.</p>
          )}
          {passkeyStatus === "error" && (
            <p className="mt-2 text-sm text-red-600">❌ Registration failed. Try again.</p>
          )}
        </div>
      </div>

      {/* My Rides Section */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-stone-900 mb-4 flex items-center gap-2">
          🚕 My Rides as Passenger
        </h2>

        {ridesLoading ? (
          <p className="text-stone-600">Loading your rides...</p>
        ) : passengerRides.length === 0 ? (
          <div className="bg-white border rounded-xl shadow-sm p-6 text-center">
            <p className="text-stone-600">You haven&apos;t requested any rides yet.</p>
            <button
              onClick={() => navigate("/passenger/search")}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Find Your First Ride
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {passengerRides.map((ride) => (
              <div
                key={ride._id}
                className="bg-white border rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${ride.status === "APPROVED"
                    ? "bg-green-100 text-green-700"
                    : ride.status === "REJECTED"
                      ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-700"
                    }`}>
                    {ride.status}
                  </span>
                  <span className="text-xs text-stone-500">
                    {new Date(ride.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-stone-600">From:</span>
                    <p className="font-medium text-stone-900">
                      {ride.tripId?.source || "Unknown"}
                    </p>
                  </div>
                  <div>
                    <span className="text-stone-600">To:</span>
                    <p className="font-medium text-stone-900">
                      {ride.tripId?.destination || "Unknown"}
                    </p>
                  </div>
                  <div>
                    <span className="text-stone-600">Driver:</span>
                    <p className="font-medium text-stone-900">
                      {ride.tripId?.driverId?.name || "Unknown Driver"}
                    </p>
                  </div>
                  {ride.tripId?.departureTime && (
                    <div>
                      <span className="text-stone-600">Departure:</span>
                      <p className="font-medium text-stone-900">
                        {new Date(ride.tripId.departureTime).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {ride.tripId?.seatsAvailable !== undefined && (
                    <div>
                      <span className="text-stone-600">Seats Available:</span>
                      <span className="font-medium text-stone-900 ml-2">
                        {ride.tripId.seatsAvailable}
                      </span>
                    </div>
                  )}
                </div>

                {/* Track Trip Button for approved and active rides */}
                {ride.status === 'APPROVED' && ride.tripId?.status && ['STARTED', 'SCHEDULED'].includes(ride.tripId.status) && (
                  <div className="mt-3">
                    <button
                      onClick={() => navigate(`/passenger/ride/${ride._id}`)}
                      className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
                    >
                      {ride.tripId.status === 'STARTED' ? '🚗 Track Live' : '📍 View Details'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeDashboard;
