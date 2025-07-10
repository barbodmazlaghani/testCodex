import React from 'react';
import styled from 'styled-components';

// Styled components
const StyledCard = styled.div`
  background-color: #282c33; // A dark blue color
  color: white; // Set text color to white
  border: 1px solid #223D5E; // A slightly lighter blue for the border
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3); // Darker shadow for contrast
  padding: 15px;
  margin-bottom: 20px;
  width: 200px;

  @media (max-width: 1024px) {
    width: 200px; // Smaller width on medium screens
  }

  @media (max-width: 768px) {
    width: 100%; // Full width on small screens
    max-width: 300px; // Limit max width
  }
`;

const CardTitle = styled.h5`
    font-size: 1.2em;
    margin-bottom: 10px;
`;

const CardText = styled.p`
  font-size: 1em;
  color: #b6acac;
`;

const CardUnit = styled.p`
  font-size: 0.8em;
  color: #726b6b;
`;

// Card component
const Card = ({ name, value, unit }) => (
    <StyledCard>
        <CardText>{name}</CardText>
        <CardTitle>{value}</CardTitle>
        <CardUnit>{unit}</CardUnit>
    </StyledCard>
);

export default Card;