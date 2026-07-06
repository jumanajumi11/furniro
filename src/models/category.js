import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema({

  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
  },

  description: {
    type: String,
    trim: true,
    default: ''
  },

  isDeleted: {
    type: Boolean,
    default: false
  },

 
  isListed: {
    type: Boolean,
    default: true
  },

  image: {
    type: String,
    default: ''
  },

}, { timestamps: true });


CategorySchema.pre('save', async function () {

  if (this.isModified('name')) {
    this.name = this.name.trim();

    const existing = await this.constructor.findOne({
      name: {
        $regex: `^${this.name.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&')}$`,
        $options: 'i'
      },
      isDeleted: false
    });

    if (existing && existing._id.toString() !== this._id.toString()) {
      const err = new Error('Category name already exists');
      err.name = 'ValidationError';
      throw err;
    }
  }
});


const Category =
  mongoose.models.Category ||
  mongoose.model('Category', CategorySchema);

export default Category;