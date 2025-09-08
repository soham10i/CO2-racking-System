# CO2 Footprints Tracking Project

## Description

This project is designed to help individual users track their CO2 footprints from various activities such as transportation and household energy consumption. By monitoring and managing their carbon emissions, users can make informed decisions to reduce their environmental impact.

## Setup Instructions

### Prerequisites

- Java Development Kit (JDK) 11 or higher
- Maven
- Git

### Steps to Setup on MacOS and Linux

1. **Clone the Repository**

   ```bash
   git clone https://git.oth-aw.de/7e41/team2-co2tracker-rep.git
   cd team2-co2tracker-rep
   ```
2. **Navigate to the Project Directory**

   ```bash
   cd team2-co2tracker-rep
   ```
3. **Install Dependencies**

   ```bash
   mvn clean install
   ```
4. **Run the Spring Boot Application**

   ```bash
   mvn spring-boot:run
   ```
5. **Access the Application**
   Open your browser and navigate to `http://localhost:6060/login.html` to access the login page.

## API Endpoints

### Authentication

- **POST /auth/signup**: Register a new user.
  - **Request Body:**
    ```json
    {
      "username": "user1",
      "password": "password123",
      "email": "user1@example.com"
    }
    ```
  - **Response Body:**
    ```json
    {
      "message": "User registered successfully"
    }
    ```

- **POST /auth/signin**: Authenticate an existing user.
  - **Request Body:**
    ```json
    {
      "username": "user1",
      "password": "password123"
    }
    ```
  - **Response Body:**
    ```json
    {
      "token": "jwt-token"
    }
    ```

- **POST /auth/refresh**: Refresh the authentication token.
  - **Request Body:**
    ```json
    {
      "token": "expired-jwt-token"
    }
    ```
  - **Response Body:**
    ```json
    {
      "token": "new-jwt-token"
    }
    ```

### User Profile

- **GET /user/get-profile**: Fetch the user profile details.
  - **Response Body:**
    ```json
    {
      "username": "user1",
      "email": "user1@example.com",
      "createdAt": "2023-01-01T00:00:00Z"
    }
    ```

- **PUT /user/update-profile**: Update the user profile details.
  - **Request Body:**
    ```json
    {
      "email": "newemail@example.com"
    }
    ```
  - **Response Body:**
    ```json
    {
      "message": "Profile updated successfully"
    }
    ```

### Transportation CO2 Tracking

- **POST /calculator/transportation/calculate**: Calculate and save CO2 emissions for transportation.
  - **Request Body:**
    ```json
    {
      "type": "car",
      "distance": 100,
      "fuelType": "petrol"
    }
    ```
  - **Response Body:**
    ```json
    {
      "emissions": 23.5
    }
    ```

- **GET /calculator/transportation/car/{id}**: Retrieve car details by ID.
  - **Response Body:**
    ```json
    {
      "id": 1,
      "type": "car",
      "distance": 100,
      "fuelType": "petrol",
      "emissions": 23.5
    }
    ```

- **GET /calculator/transportation/flight/{id}**: Retrieve flight details by ID.
  - **Response Body:**
    ```json
    {
      "id": 1,
      "type": "flight",
      "distance": 1000,
      "emissions": 200.0
    }
    ```

- **GET /calculator/transportation/bike/{id}**: Retrieve bike details by ID.
  - **Response Body:**
    ```json
    {
      "id": 1,
      "type": "bike",
      "distance": 20,
      "emissions": 0.0
    }
    ```

- **GET /calculator/transportation/user/data**: Retrieve all transportation data by user email.
  - **Response Body:**
    ```json
    [
      {
        "id": 1,
        "type": "car",
        "distance": 100,
        "fuelType": "petrol",
        "emissions": 23.5
      },
      {
        "id": 2,
        "type": "flight",
        "distance": 1000,
        "emissions": 200.0
      }
    ]
    ```

- **PUT /calculator/transportation/update/car/{id}**: Update car details by ID.
  - **Request Body:**
    ```json
    {
      "distance": 150,
      "fuelType": "diesel"
    }
    ```
  - **Response Body:**
    ```json
    {
      "message": "Car details updated successfully"
    }
    ```

- **PUT /calculator/transportation/update/flight/{id}**: Update flight details by ID.
  - **Request Body:**
    ```json
    {
      "distance": 1200
    }
    ```
  - **Response Body:**
    ```json
    {
      "message": "Flight details updated successfully"
    }
    ```

- **PUT /calculator/transportation/update/bike/{id}**: Update bike details by ID.
  - **Request Body:**
    ```json
    {
      "distance": 25
    }
    ```
  - **Response Body:**
    ```json
    {
      "message": "Bike details updated successfully"
    }
    ```

- **DELETE /calculator/transportation/car/delete/{id}**: Delete car entry by ID.
  - **Response Body:**
    ```json
    {
      "message": "Car entry deleted successfully"
    }
    ```

- **DELETE /calculator/transportation/flight/delete/{id}**: Delete flight entry by ID.
  - **Response Body:**
    ```json
    {
      "message": "Flight entry deleted successfully"
    }
    ```

- **DELETE /calculator/transportation/bike/delete/{id}**: Delete bike entry by ID.
  - **Response Body:**
    ```json
    {
      "message": "Bike entry deleted successfully"
    }
    ```

### Household Carbon Footprint

- **POST /calculator/household/add**: Add household carbon footprint data.
  - **Request Body:**
    ```json
    {
      "electricityUsage": 500,
      "waterUsage": 100
    }
    ```
  - **Response Body:**
    ```json
    {
      "emissions": 50.0
    }
    ```

- **POST /calculator/household/update/{id}**: Update household carbon footprint data by ID.
  - **Request Body:**
    ```json
    {
      "electricityUsage": 600,
      "waterUsage": 120
    }
    ```
  - **Response Body:**
    ```json
    {
      "message": "Household data updated successfully"
    }
    ```

- **POST /calculator/household/delete/{id}**: Delete household carbon footprint data by ID.
  - **Response Body:**
    ```json
    {
      "message": "Household data deleted successfully"
    }
    ```

### Password Reset

- **POST /auth/forgot-password**: Request a password reset link.
  - **Request Body:**
    ```json
    {
      "email": "user1@example.com"
    }
    ```
  - **Response Body:**
    ```json
    {
      "message": "Password reset link sent"
    }
    ```

- **POST /auth/reset-password**: Reset the password using the token.
  - **Request Body:**
    ```json
    {
      "token": "reset-token",
      "newPassword": "newpassword123"
    }
    ```
  - **Response Body:**
    ```json
    {
      "message": "Password reset successfully"
    }
    ```
