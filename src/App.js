import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import ParticlesComponent from './particles';
import './App.css';
import SelectMode from './SelectMode';
import CreateOrJoinRoom from './CreateOrJoinRoom';
import CreateRoom from './CreateRoom';
import HomePage from './HomePage';
import GameComponent from './GameComponent';
import Button from '@mui/material/Button';
import CallIcon from '@mui/icons-material/Call';


const socket = io('https://hand-cricket-backend-88ey.onrender.com')
function App() {
  const userName = useRef('');
  const joinRoomId = useRef('');
  const [roomId, setRoomId] = useState('');
  const [playMatch, setPlayMatch] = useState(false);
  const [userRegistered, setUserRegistered] = useState(false);
  const [roomCreated, setRoomCreated] = useState(false);
  const [activeRooms, setActiveRooms] = useState([{}]);
  const [isDisabled, setIsDisabled] = useState(false);
  const [isSelectMode, setSelectedMode] = useState(false);
  const [isSinglePlayer, setSinglePlayer] = useState(false);

  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [peerConnection, setPeerConnection] = useState(null);


  const setUser = () => {
    setUserRegistered(true);
  }

  const createRoom = () => {
    socket.emit('create room', userName.current);
    setRoomCreated(true);
  }

  const joinRoom = () => {
    socket.emit('join room', userName.current, joinRoomId.current);
  }

  const playerMove = (move) => {
    socket.emit('player move', roomId, move);
    setIsDisabled(true);
  }

  const modeSelected = (mode) => {
    setSelectedMode(true);
    if (mode === 'singleplayer') {
      setSinglePlayer(true);
      socket.emit('play with cpu', userName.current);
    }
  }

  const handleChange = (event) => {
    userName.current = event;
  };

  const handleChangeRoomId = (event) => {
    joinRoomId.current = event;
  }


  useEffect(() => {
    socket.on('room created', (roomId) => {
      setRoomId(roomId);
    });

    socket.on('room not found', () => {
      alert('Room not found');
    });

    socket.on('room full', () => {
      alert('Room is full only 2 users allowed');
    });

    socket.on('can play now', (roomId, activeRooms) => {
      setPlayMatch(true);
      setRoomId(roomId);
      setActiveRooms(activeRooms);

    });

    socket.on('score updated', (activeRooms) => {
      setActiveRooms(activeRooms);
      setIsDisabled(false);
    })

    socket.on('bowled out', (batting, bowling, activeRooms, batterScore) => {
      alert(`${batting} scored ${batterScore} and is Bowled Out.  ${bowling} will bat now`);
      setIsDisabled(false);
      setActiveRooms(activeRooms);
    })

    socket.on('user2 won match', (winner, roomId) => {
      let playOneMoreMatch = window.confirm(`${winner} won the match Do you want to play one more match?`);
      if (playOneMoreMatch) {
        socket.emit('play again', roomId);
      }
      else {
        userName.current = '';
        setUserRegistered(false);
        setPlayMatch(false);
        setRoomCreated(false);
        setActiveRooms([]);
        setIsDisabled(false);
      }
    })

    socket.on('restartMatch', (activeRooms) => {
      setActiveRooms(activeRooms);
      setIsDisabled(false);
    })

    socket.on('out', (winner, draw, activeRooms, roomId) => {
      setActiveRooms(activeRooms);
      let playOneMoreMatch;
      if (draw) {
        playOneMoreMatch = window.confirm('Match Draw Do You want to play one more match?');
      }
      else {
        playOneMoreMatch = window.confirm(`${winner} won the match Do You want to play one more match?`);
      }
      if (playOneMoreMatch) {
        socket.emit('play again', roomId);
      }
      else {
        userName.current = '';
        setUserRegistered(false);
        setPlayMatch(false);
        setRoomCreated(false);
        setActiveRooms([]);
        setIsDisabled(false);
      }
    })

  }, []);
  
  const initializePeerConnection = async () => {
    try {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' } // Using a public STUN server
            ]
        });

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localAudioRef.current.srcObject = stream;
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('candidate', event.candidate);
            }
        };

        pc.ontrack = (event) => {
            if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = event.streams[0];
            }
        };

        socket.on('offer', async (offer) => {
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('answer', answer);
            } catch (error) {
                console.error('Error setting remote description or creating answer:', error);
            }
        });

        socket.on('answer', async (answer) => {
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
            } catch (error) {
                console.error('Error setting remote description:', error);
            }
        });

        socket.on('candidate', async (candidate) => {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error('Error adding ice candidate:', error);
            }
        });

        setPeerConnection(pc); // Set peerConnection after it's fully initialized
    } catch (error) {
        console.error('Error initializing peer connection:', error);
    }
};

const createOffer = async () => {
    if (!peerConnection) {
        console.error('Peer connection not established.');
        return;
    }

    try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('offer', offer);
    } catch (error) {
        console.error('Error creating offer:', error);
    }
};

  return (
    <>
      <ParticlesComponent id='particles'></ParticlesComponent>
      {!userRegistered && !roomCreated &&
        <HomePage handleChange={handleChange} setUser={setUser}></HomePage>
      }

      {
        userRegistered && !isSelectMode &&
        <SelectMode modeSelected={modeSelected}></SelectMode>
      }

      {
        roomCreated && !playMatch && userRegistered && isSelectMode &&
        <CreateRoom roomId={roomId}></CreateRoom>
      }

      {!playMatch && userRegistered && !roomCreated && isSelectMode &&
        <CreateOrJoinRoom createRoom={createRoom} joinRoom={joinRoom} handleChangeRoomId={handleChangeRoomId}></CreateOrJoinRoom>
      }

      {playMatch &&
       <>
        <GameComponent roomId={roomId} activeRooms={activeRooms} playerMove={playerMove} isDisabled={isDisabled}></GameComponent>
        && {!isSinglePlayer &&
        <div className='d-flex justify-content-center'>
          <Button variant="contained"
              color="primary"
              onClick={initializePeerConnection} >Initialize Connection to Join</Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<CallIcon />}
            onClick={createOffer}
            style={{ marginLeft: '8px' }}
            disabled={!peerConnection}
          >
            Call
          </Button>
          <audio ref={localAudioRef} autoPlay muted />
          <audio ref={remoteAudioRef} autoPlay />
        </div>
}
        </>
      }
    </>
  );
}

export default App;
