const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AttendChain", function () {
  let attend, admin, teacher, alice, bob, carol;

  beforeEach(async function () {
    [admin, teacher, alice, bob, carol] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("AttendChain");
    attend = await Factory.deploy();
    await attend.waitForDeployment();
  });

  describe("Roles & registration", function () {
    it("sets deployer as admin and a teacher", async function () {
      expect(await attend.admin()).to.equal(admin.address);
      expect(await attend.isTeacher(admin.address)).to.equal(true);
    });

    it("lets admin add a teacher", async function () {
      await expect(attend.addTeacher(teacher.address))
        .to.emit(attend, "TeacherAdded")
        .withArgs(teacher.address);
      expect(await attend.isTeacher(teacher.address)).to.equal(true);
    });

    it("blocks non-admin from adding a teacher", async function () {
      await expect(
        attend.connect(alice).addTeacher(bob.address)
      ).to.be.revertedWith("Only admin");
    });

    it("lets admin register a student", async function () {
      await expect(attend.registerStudent(alice.address, "Alice", "S001"))
        .to.emit(attend, "StudentRegistered")
        .withArgs(alice.address, "Alice", "S001");
      const s = await attend.students(alice.address);
      expect(s.registered).to.equal(true);
      expect(s.name).to.equal("Alice");
    });

    it("rejects double registration", async function () {
      await attend.registerStudent(alice.address, "Alice", "S001");
      await expect(
        attend.registerStudent(alice.address, "Alice", "S001")
      ).to.be.revertedWith("Already registered");
    });
  });

  describe("Sessions", function () {
    beforeEach(async function () {
      await attend.addTeacher(teacher.address);
    });

    it("lets a teacher create a session", async function () {
      await expect(attend.connect(teacher).createSession("Blockchain 101"))
        .to.emit(attend, "SessionCreated")
        .withArgs(0, "Blockchain 101", teacher.address);
      expect(await attend.sessionCount()).to.equal(1);
      const s = await attend.getSession(0);
      expect(s.courseName).to.equal("Blockchain 101");
      expect(s.open).to.equal(true);
    });

    it("blocks non-teachers from creating a session", async function () {
      await expect(
        attend.connect(alice).createSession("Hacky 101")
      ).to.be.revertedWith("Only a teacher");
    });

    it("lets the creating teacher close a session", async function () {
      await attend.connect(teacher).createSession("Blockchain 101");
      await expect(attend.connect(teacher).closeSession(0))
        .to.emit(attend, "SessionClosed")
        .withArgs(0);
      const s = await attend.getSession(0);
      expect(s.open).to.equal(false);
    });

    it("blocks an unrelated account from closing a session", async function () {
      await attend.connect(teacher).createSession("Blockchain 101");
      await expect(
        attend.connect(alice).closeSession(0)
      ).to.be.revertedWith("Not authorized");
    });
  });

  describe("Marking attendance", function () {
    beforeEach(async function () {
      await attend.addTeacher(teacher.address);
      await attend.registerStudent(alice.address, "Alice", "S001");
      await attend.registerStudent(bob.address, "Bob", "S002");
      await attend.connect(teacher).createSession("Blockchain 101");
    });

    it("lets a registered student mark their own attendance", async function () {
      await expect(attend.connect(alice).markAttendance(0))
        .to.emit(attend, "AttendanceMarked");
      expect(await attend.isPresent(0, alice.address)).to.equal(true);
      const s = await attend.getSession(0);
      expect(s.attendeeCount).to.equal(1);
    });

    it("PREVENTS PROXY: a student cannot mark for an absent friend", async function () {
      // Carol is NOT registered. Even if Alice wanted to help her friend Carol,
      // markAttendance only ever credits msg.sender. Carol must sign herself,
      // and she is not registered, so she is rejected.
      await expect(
        attend.connect(carol).markAttendance(0)
      ).to.be.revertedWith("Not a registered student");
      // And when Alice marks, only Alice is credited -- never anyone else.
      await attend.connect(alice).markAttendance(0);
      expect(await attend.isPresent(0, carol.address)).to.equal(false);
    });

    it("PREVENTS DOUBLE MARKING", async function () {
      await attend.connect(alice).markAttendance(0);
      await expect(
        attend.connect(alice).markAttendance(0)
      ).to.be.revertedWith("Already marked");
      const s = await attend.getSession(0);
      expect(s.attendeeCount).to.equal(1);
    });

    it("blocks unregistered accounts from marking", async function () {
      await expect(
        attend.connect(carol).markAttendance(0)
      ).to.be.revertedWith("Not a registered student");
    });

    it("blocks marking after the session is closed (no back-dating)", async function () {
      await attend.connect(teacher).closeSession(0);
      await expect(
        attend.connect(alice).markAttendance(0)
      ).to.be.revertedWith("Session is closed");
    });

    it("records the full attendee list transparently", async function () {
      await attend.connect(alice).markAttendance(0);
      await attend.connect(bob).markAttendance(0);
      const list = await attend.getAttendees(0);
      expect(list).to.have.lengthOf(2);
      expect(list).to.include(alice.address);
      expect(list).to.include(bob.address);
    });
  });
});
