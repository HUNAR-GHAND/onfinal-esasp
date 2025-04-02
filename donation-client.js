// Check if user is logged in
let userId = null;
const userDataString = localStorage.getItem('userData');
if (userDataString) {
    try {
        const userData = JSON.parse(userDataString);
        userId = userData.id;

        // Update points display with user points
        fetch(`/api/users/${userId}/points`)
            .then(response => response.json())
            .then(data => {
                document.getElementById('user-points').textContent = data.points;
            })
            .catch(error => console.error('Error fetching points:', error));
    } catch (e) {
        console.error('Error parsing user data:', e);
    }
}

// Handle donation form submission
document.getElementById('donationForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = new FormData(this);

    // Add user ID if available
    if (userId) {
        formData.append('userId', userId);
    }

    try {
        const response = await fetch('/api/donations', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            // Refresh donation history
            loadDonationHistory();

            // Reset form
            this.reset();

            // Show success message
            alert('Donation submitted successfully!');

            // If user is logged in, update points display
            if (userId) {
                fetch(`/api/users/${userId}/points`)
                    .then(response => response.json())
                    .then(data => {
                        document.getElementById('user-points').textContent = data.points;
                    })
                    .catch(error => console.error('Error updating points:', error));
            }
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error('Error submitting donation:', error);
        alert('Error submitting donation. Please try again.');
    }
});

// Load donation history
function loadDonationHistory() {
    const endpoint = userId ?
        `/api/users/${userId}/donations` :
        '/api/donations';

    fetch(endpoint)
        .then(response => response.json())
        .then(data => {
            const donations = Array.isArray(data) ? data : (data.donations || []);
            updateDonationHistoryDisplay(donations);
        })
        .catch(error => console.error('Error fetching donations:', error));
}

// Update donation history display
function updateDonationHistoryDisplay(donations) {
    const donationList = document.getElementById('donationList');
    donationList.innerHTML = '';

    if (donations.length === 0) {
        donationList.innerHTML = '<p>No donations yet.</p>';
        return;
    }

    donations.forEach(donation => {
                const donationElement = document.createElement('div');
                donationElement.className = 'donation-item';

                let donorImageHtml = '';
                if (donation.photoPath) {
                    donorImageHtml = `<img src="${donation.photoPath}" class="donor-image" alt="${donation.name}">`;
                }

                const date = new Date(donation.date).toLocaleDateString();

                donationElement.innerHTML = `
            <div class="donation-item-header">
                ${donorImageHtml}
                <h3>${donation.name}</h3>
            </div>
            <p>Contact: ${donation.contact}</p>
            <p>Address: ${donation.address}</p>
            <p>Book: "${donation.bookName}" by ${donation.authorName} (${donation.edition} Edition)</p>
            <p>Amount: ₹${donation.amount}</p>
            <p>Points Earned: ${donation.points}</p>
            <p>Date: ${date}</p>
            ${donation.message ? `<p>Message: ${donation.message}</p>` : ''}
        `;
        donationList.appendChild(donationElement);
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadDonationHistory();
});